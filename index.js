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
    //Be careful with the URL encoding
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
                word["outgoingRelationship"] = [];
                break;
            case "// les relations entrantes : r;rid;node1;node2;type;w ":
                console.log("Beginning ingoing relationship");
                reading = "ingoingRelationship";
                word["ingoingRelationship"] = [];
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
                            if(lineSplitted.length > 1) {
                                word["outgoingRelationship"].push({
                                    node: parseInt(lineSplitted[3]),
                                    type: parseInt(lineSplitted[4]),
                                    weight: parseInt(lineSplitted[5])
                                });
                            }
                            break;
                        case "ingoingRelationship":
                            lineSplitted = line.split(";");
                            if(lineSplitted.length > 1) {
                                word["ingoingRelationship"].push({
                                    node: parseInt(lineSplitted[2]),
                                    type: parseInt(lineSplitted[4]),
                                    weight: parseInt(lineSplitted[5])
                                });
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

async function findLinkBetweenWords(w1, r, w2) {
    //Check if relation exists inside relations as a key
    if (r in relations) {
        let relationId = relations[r];

        //Retrieve the two words
        let words = await Promise.all([getWord(w1), getWord(w2)]);

        //Check if relation exists in relationType
        if (!(relationId in words[0].relationType) && !(relationId in words[1].relationType)) {
            console.log("Il n'y a pas de relation explicite " + r + " entre " + w1 + " et " + w2);
            return;
        }

        //Read all outgoing nodes for word1
        let word1 = words[0].outgoingRelationship;
        //Keep only the nodes that are related to the relation
        let word1filtered = word1.filter(relation => relation.type === relationId);
        //Keep only the node key
        let word1filteredNodes = word1filtered.map(relation => relation.node);

        //Read all ingoing nodes for word2
        let word2 = words[1].ingoingRelationship;
        //Keep only the nodes that are related to the relation
        let word2filtered = word2.filter(relation => relation.type === relationId);
        //Keep only the node key
        let word2filteredNodes = word2filtered.map(relation => relation.node);

        //Check if the relation exists between the two words
        //w1 relation x new_relation w2
        let a = word2.filter(node => word1filteredNodes.includes(node.node));
        //Keep only positive correlations
        a = a.filter(node => node.weight > 0);
        //Sort by weight
        a.sort((a, b) => b.weight - a.weight);
        // for(let rel of a) {
        //     console.log(w1 + " " + r + " " + words[1].nodeTerms[rel.node].name + " " + words[1].relationType[rel.type].name + " (" + rel.weight + ") " + w2);
        // }
        let interestingRelations1 = {};
        for (let relation of a) {
            if (!(relation.type in interestingRelations1)) {
                interestingRelations1[relation.type] = {
                    w1: w1,
                    r1: r,
                    y: words[1].nodeTerms[relation.node].name,
                    r2: words[1].relationType[relation.type].name,
                    weight: relation.weight,
                    w2: w2
                };
            }
        }

        //w1 new_relation x relation w2
        let b = word1.filter(node => word2filteredNodes.includes(node.node));
        //Keep only positive correlations
        b = b.filter(node => node.weight > 0);
        //Sort by weight
        b.sort((a, b) => b.weight - a.weight);
        // for(let rel of b) {
        //     console.log(w1 + " " + words[0].relationType[rel.type].name + " (" + rel.weight + ") " + words[0].nodeTerms[rel.node].name + " " + r + " " + w2);
        // }
        let interestingRelations2 = {};
        for (let relation of b) {
            if (!(relation.type in interestingRelations2)) {
                interestingRelations2[relation.type] = {
                    w1: w1,
                    r1: words[0].relationType[relation.type].name,
                    weight: relation.weight,
                    y: words[0].nodeTerms[relation.node].name,
                    r2: r,
                    w2: w2
                };
            }
        }

        return [interestingRelations1, interestingRelations2];
    } else {
        throw new Error("La relation n'existe pas");
    }
}

function prettyPrintRelations(relations) {
    //Turn to array
    let relationsArray = Object.keys(relations).map(key => relations[key]);
    //Sort by weight
    relationsArray.sort((a, b) => b.weight - a.weight);
    //Only keep the 3 first
    relationsArray = relationsArray.slice(0, 3);

    for (let relation of relationsArray) {
        console.log(relation.w1 + " " + relation.r1 + " " + relation.y + " " + relation.r2 + " " + relation.w2 + " (" + relation.weight + ")");
    }
}

function executeInference(sentence) {
    //Split the sentence into words
    let words = sentence.split(" ");
    //Check if one of the words is a relation
    let relationsFound = words.filter(word => word in relations);
    if(relationsFound.length === 0) {
        console.log("La relation n'existe pas, avez-vous fait une faute d'orthographe ?");
    } else if (relationsFound.length === 1) {
        //Get the words and the relation
        words = sentence.split(relationsFound[0]);
        //Remove spaces for each word
        words = words.map(word => word.trim());

        findLinkBetweenWords(words[0], relationsFound[0], words[1])
            .then(([r1, r2]) => {
                prettyPrintRelations(r1);
                console.log("\n");
                prettyPrintRelations(r2);
            })
            .catch(console.log);
    }

}

//Read relations.json
let relations = JSON.parse(fs.readFileSync("./relations.json"));

executeInference("pigeon r_agent-1 voler");

