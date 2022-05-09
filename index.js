const fs = require("fs");
const readline = require("readline")
//HTTP requests
const axios = require("axios");
//Converting Windows-1252 to UTF-8
var iconv = require('iconv-lite');


/**
 * Check if cache exists, and if not create one
 */
function checkCacheExists() {
    //Check if the folder cache exists
    if (!fs.existsSync("./cache")) {
        fs.mkdirSync("./cache");
    }

    //Check if cached.json exists
    if (!fs.existsSync("./cache/cached.json")) {
        fs.writeFileSync("./cache/cached.json", "[]");
    }
}

/**
 * Return the JSON data for a word, if it exists at all, else throws an Error
 * @param word : The word to search for
 * @returns {JSON} : data for the word
 */
async function getWord(word) {
    checkCacheExists();
    //Check if the word is in the cache
    let cached = JSON.parse(fs.readFileSync("./cache/cached.json"));
    let cachedWord = cached.find(x => x.word === word);

    if (cachedWord) {
        console.log("FOUND IN CACHE");
        if (cachedWord.state === "PROCESSED") {
            return getWordFromCache(cachedWord.id);
        } else if (cachedWord.state === "HTML") {
            return await getWordFromHTML(fs.readFileSync(`./cache/${cachedWord.id}.html`), cachedWord.id);
        } else if (cachedWord.state === "NOT_EXIST") {
            throw new Error(word + " n'est pas un mot valide");
        }
    } else {
        return await getWordFromRezoDump(word);
    }
}

/**
 * Return the JSON data cached for a word
 * @param id
 * @returns {JSON} : data for the word
 */
function getWordFromCache(id) {
    return JSON.parse(fs.readFileSync("./cache/" + id + ".json"));
}

async function getWordFromHTML(html, id) {
    let cached = JSON.parse(fs.readFileSync("./cache/cached.json"));
    let cachedWord = cached.find(x => x.id === id);

    //Save decodedFile
    let jsonData = await readLineByLine(id, cachedWord.word);
    fs.writeFileSync(`./cache/${id}.json`, JSON.stringify(jsonData, null, 4));

    //Set the state to PROCESSED
    cachedWord.state = "PROCESSED";
    fs.writeFileSync("./cache/cached.json", JSON.stringify(cached, null, 4));

    return jsonData;
}

/**
 * Fetch the data for a word from RezoDump and save it in the cache as HTML, or throws an error if it doesn't exist
 * @param word
 * @returns {JSON} : data for the word
 */
async function getWordFromRezoDump(word) {
    let cached = JSON.parse(fs.readFileSync("./cache/cached.json"));

    //Get the definition from the API with axios in windows-1252
    let response = await axios.get(`http://www.jeuxdemots.org/rezo-dump.php?gotermsubmit=Chercher&gotermrel=${word}&rel=`, {
        responseType: 'arraybuffer'
    });
    const decodedData = iconv.decode(response.data, 'windows-1252');

    //Check if word exists
    let errorString = `Le terme '${word}' n'existe pas !`;
    let error = decodedData.match(errorString);
    if (error) {
        cached.push({id: null, word: word, state:"NOT_EXIST"});
        fs.writeFileSync("./cache/cached.json", JSON.stringify(cached, null, 4));
        throw new Error(word + " n'est pas un mot valide");
    } else {
        //Find eid= in the response
        let eid = decodedData.match(/eid=\d+/g);
        //Get the id of the word
        let id = eid[0].split("=")[1];

        //Save raw file (in windows-1252)
        fs.writeFileSync(`./cache/${id}.html`, decodedData);
        cached.push({id: id, word: word, state:"HTML"});

        //Save cached.json
        fs.writeFileSync("./cache/cached.json", JSON.stringify(cached, null, 4));

        return await getWordFromHTML(decodedData, id);
    }
}

/**
 * Read a file line by line and return the JSON data
 * @param wordId : the id of the word
 * @param wordString : the word to search for
 * @returns {JSON} : data for the word
 */
async function readLineByLine(wordId, wordString) {
    const fileStream = fs.createReadStream(`./cache/${wordId}.html`);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let reading = "";
    let word = {};
    let lineSplitted = "";
    word.word = wordString;
    word.id = wordId;

    for await (const line of rl) {
        switch (line) {
            case '<def>':
                console.log("Beginning of definition");
                reading = "def";
                break;
            case '</def>':
                console.log("End of definition")
                reading = ""
                break;
            case "// les types de noeuds (Nodes Types) : nt;ntid;'ntname'":
                console.log("Beginning of node types");
                reading = "nodeType"
                word["nodeType"] = {};
                break;
            case "// les noeuds/termes (Entries) : e;eid;'name';type;w;'formated name' ":
                console.log("Beginning of node/terms");
                reading = "nodeTerms";
                word["nodeTerms"] = {};
                break;
            case "// les types de relations (Relation Types) : rt;rtid;'trname';'trgpname';'rthelp' ":
                console.log("Beginning of relation types");
                reading = "relationType";
                word["relationType"] = {};
                break;
            case "// les relations sortantes : r;rid;node1;node2;type;w ":
                console.log("Beginning outgoing relationship");
                reading = "outgoingRelationship";
                word["outgoingRelationship"] = {};
                break;
            case "// les relations entrantes : r;rid;node1;node2;type;w ":
                console.log("Beginning ingoing relationship");
                reading = "ingoingRelationship";
                word["ingoingRelationship"] = {};
                break;
            case "// END":
                console.log("End of file");
                reading = "";
                break;
            default:
                if (line !== "") {
                    switch (reading) {
                        case "def":
                            word["definiton"] = line;
                            break;
                        case "nodeType":
                            lineSplitted = line.split(';');
                            word["nodeType"][parseInt(lineSplitted[1])] = lineSplitted[2].slice(1, -1);
                            break;
                        case "nodeTerms":
                            lineSplitted = line.split(";");
                            word["nodeTerms"][parseInt(lineSplitted[1])] = {
                                name: lineSplitted[2].slice(1, -1),
                                type: parseInt(lineSplitted[3]),
                                weight: parseInt(lineSplitted[4]),
                                formattedName: lineSplitted.length > 5 ? lineSplitted[5].slice(1, -1) : null
                            }
                            break;
                        case "relationType":
                            lineSplitted = line.split(";");
                            word["relationType"][parseInt(lineSplitted[1])] = {
                                name: lineSplitted[2].slice(1, -1),
                                gpName: lineSplitted[3].slice(1, -1),
                                consigne: lineSplitted[4]
                            }
                            break;
                        case "outgoingRelationship":
                            lineSplitted = line.split(";");
                            word["outgoingRelationship"][parseInt(lineSplitted[1])] = {
                                outGoingNode: parseInt(lineSplitted[3]),
                                type: parseInt(lineSplitted[4]),
                                weight: parseInt(lineSplitted[5])
                            }
                            break;
                        case "ingoingRelationship":
                            lineSplitted = line.split(";");
                            word["ingoingRelationship"][parseInt(lineSplitted[1])] = {
                                inGoingNode: parseInt(lineSplitted[2]),
                                type: parseInt(lineSplitted[4]),
                                weight: parseInt(lineSplitted[5])
                            }
                            break;
                        default:
                            break;
                    }
                }
        }
    }
    return word;
}

getWord("sdgsdhsdfh").then(result => {

});