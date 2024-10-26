const fs = require("fs");
const readline = require("readline")
//HTTP requests
const axios = require("axios");
//Converting Windows-1252 to UTF-8
const iconv = require('iconv-lite');
const express = require("express");
const path = require("path");
const app = express();
const bodyParser = require('body-parser')
const port = process.env.PORT || 3000;
const cors = require("cors");

//Geometric mean
function geometricMean(array) {
    return Math.pow(array.reduce((a, b) => parseInt(a) * parseInt(b)), 1 / array.length);
}

//Root mean square
function rootMeanSquare(array) {
    return Math.sqrt(array.reduce((a, b) => parseInt(a) + parseInt(b) * parseInt(b)) / array.length);
}

//Mean
function mean(array) {
    return array.reduce((a, b) => parseInt(a) + parseInt(b)) / array.length;
}

// create application/json parser
var jsonParser = bodyParser.json()

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
        } else if (cachedWord.state === "TOOBIG") {
            throw new Error(word + " est trop gros pour être traité par le site");
        }
    } else {
        console.log(word + " not in cache, fetching from RezoDump");
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

        //Check if the word isn't too big, contains TOOBIG_USE_DUMP
        //let tooBig = decodedData.match("TOOBIG_USE_DUMP");
        //if (tooBig) {
        //    cached.push({id: id, word: word, state:"TOOBIG"});
        //    fs.writeFileSync("./cache/cached.json", JSON.stringify(cached, null, 4));
        //    throw new Error(word + " est trop gros pour être traité par le site");
        //}

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
                break;
            case '</def>':
                reading = ""
                break;
            case "// les types de noeuds (Nodes Types) : nt;ntid;'ntname'":
                reading = "nodeType"
                word["nodeType"] = {};
                break;
            case "// les noeuds/termes (Entries) : e;eid;'name';type;w;'formated name' ":
                reading = "nodeTerms";
                word["nodeTerms"] = {};
                break;
            case "// les types de relations (Relation Types) : rt;rtid;'trname';'trgpname';'rthelp' ":
                reading = "relationType";
                word["relationType"] = {};
                break;
            case "// les relations sortantes : r;rid;node1;node2;type;w;w_normed;rank ":
                reading = "outgoingRelationship";
                word["outgoingRelationship"] = [];
                break;
            case "// les relations entrantes : r;rid;node1;node2;type;w ":
                reading = "ingoingRelationship";
                word["ingoingRelationship"] = [];
                break;
            case "// END":
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

    let relationId = relations[r];

    //Retrieve the two words
    let words = [null, null];
    words[0] = await getWord(w1);
    words[1] = await getWord(w2);

    //Check if relation exists in relationType
    if (!(relationId in words[0].relationType) && !(relationId in words[1].relationType)) {
        throw new Error("Il n'y a pas de relation explicite " + r + " entre " + w1 + " et " + w2);
    }

    //Read all outgoing nodes for word1
    let word1 = words[0].outgoingRelationship;
    //Keep only the nodes that are related to the relation

    //Read all ingoing nodes for word2
    let word2 = words[1].ingoingRelationship;

    if(word1 === undefined || word2 === undefined) {
        throw new Error("Le dump est incomplet, abandon");
    }

    let word1filtered = word1.filter(relation => relation.type === relationId);
    let word1filterWeighted = {}
    word1filtered.forEach(relation => { word1filterWeighted[relation.node] = relation.weight});


    //Keep only the nodes that are related to the relation
    let word2filtered = word2.filter(relation => relation.type === relationId);
    let word2filterWeighted = {}
    word2filtered.forEach(relation => { word2filterWeighted[relation.node] = relation.weight});

    //Check if the relation exists between the two words
    //w1 relation x new_relation w2
    let a = word2.filter(node => Object.keys(word1filterWeighted).includes(node.node.toString()));
    //Sort by weight
    a.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    //for(let rel of a) {
    //    console.log(w1 + " " + r + " (" + word1filterWeighted[rel.node] + ") " + words[1].nodeTerms[rel.node].name + " " + words[1].relationType[rel.type].name + " (" + rel.weight + ") " + w2);
    //}
    let interestingRelations1 = {};
    for (let relation of a) {
        if (!(relation.type in interestingRelations1)) {
            interestingRelations1[relation.type] = {
                words: [w1, words[1].nodeTerms[relation.node].name, w2],
                relations: [r, words[1].relationType[relation.type].name],
                weights: [word1filterWeighted[relation.node], relation.weight],
                scoreGeo:geometricMean([word1filterWeighted[relation.node], relation.weight]),
                scoreCube:rootMeanSquare([word1filterWeighted[relation.node], relation.weight]),
                scoreMoy:mean([word1filterWeighted[relation.node], relation.weight])
            };
        }
    }

    //w1 new_relation x relation w2
    let b = word1.filter(node => Object.keys(word2filterWeighted).includes(node.node.toString()));
    //Sort by weight
    b.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    //for(let rel of b) {
    //    console.log(w1 + " " + words[0].relationType[rel.type].name + " (" + rel.weight + ") " + words[0].nodeTerms[rel.node].name + " " + r + " (" + word2filterWeighted[rel.node] + ") " + w2);
    //}
    let interestingRelations2 = {};
    for (let relation of b) {
        if (!(relation.type in interestingRelations2)) {
            interestingRelations2[relation.type] = {
                words: [w1, words[0].nodeTerms[relation.node].name, w2],
                relations: [words[0].relationType[relation.type].name, r],
                weights: [relation.weight, word2filterWeighted[relation.node]],
                scoreGeo:geometricMean([relation.weight, word2filterWeighted[relation.node]]),
                scoreCube:rootMeanSquare([relation.weight, word2filterWeighted[relation.node]]),
                scoreMoy:mean([relation.weight, word2filterWeighted[relation.node]])
            };
        }
    }

    return [interestingRelations1, interestingRelations2];
}

function prettyPrintRelations(relations) {
    //Turn to array
    let relationsArray = Object.keys(relations).map(key => relations[key]);

    for (let relation of relationsArray) {
        let i = 0;
        while(i<relation.relations.length) {
            process.stdout.write(relation.words[i] + " " + relation.relations[i] + " (" + relation.weights[i] + ") " + relation.words[i+1] + " & ");
            i++;
        }
        process.stdout.write("(scores : cube = " + relation.scoreCube + " / geo = " + relation.scoreGeo + " / somme = " + relation.scoreMoy + ") \n");
        console.log("");
    }

    return relationsArray;
}

async function executeInference(sentence) {
    //Split the sentence into words
    let words = sentence.split(" ");
    //Check if one of the words is a relation
    let relationsFound = words.filter(word => word in relations);
    if(relationsFound.length === 0) {
        throw new Error("La relation n'existe pas, avez-vous fait une faute d'orthographe ?");
    } else if (relationsFound.length === 1) {
        //Get the words and the relation
        words = sentence.split(relationsFound[0]);
        //Remove spaces for each word
        words = words.map(word => word.trim());

        try {
            let [r1, r2] = await findLinkBetweenWords(words[0], relationsFound[0], words[1]);
            console.log('"' + sentence + '"');
            r1 = prettyPrintRelations(r1);
            r2 = prettyPrintRelations(r2);
            return r1.concat(r2);
        } catch (error) {
            throw new Error(error.message);
        }
    } else {
        throw new Error("Phrase trop longue, veuillez n'inclure qu'une seule relation");
    }
}

async function searchFurther(relation, position) {
    let [r1, r2] = await findLinkBetweenWords(relation.words[position], relation.relations[position], relation.words[position + 1]);
    r1 = prettyPrintRelations(r1);
    r2 = prettyPrintRelations(r2);
    let relations = r1.concat(r2);
    let newRelations = [];
    for (let r of relations) {
        let newWords = relation.words.slice(0, position).concat(r.words).concat(relation.words.slice(position + 1).splice(1));
        let new_r = relation.relations.slice(0, position).concat(r.relations).concat(relation.relations.slice(position + 1));
        let newWeights = relation.weights.slice(0, position).concat(r.weights).concat(relation.weights.slice(position + 1));
        let newRelation = {
            words: newWords,
            relations: new_r,
            weights: newWeights,
            scoreGeo: geometricMean(newWeights),
            scoreCube: rootMeanSquare(newWeights),
            scoreMoy: mean(newWeights)
        }
        newRelations.push(newRelation);
    }

    return newRelations;
}

//Read relations.json
let relations = JSON.parse(fs.readFileSync("./relations.json"));

async function main() {
    // await executeInference("vampire r_agent-1 mourir"); //DUMP TOO BIG
    // await executeInference("autruche r_agent-1 voler");
    // await executeInference("pigeon r_agent-1 voler");
    // let rel = await executeInference("pizza r_has_part mozza");
    // let newRel = await searchFurther(rel[0], 0);
    // console.log(newRel);
    // let newRel2 = await searchFurther(newRel[0], 2);
    // console.log(newRel2);
    //     await executeInference("demander r_provider serveuse"); //CAN'T FIND r_provider
    // await executeInference("chat r_agent-1 miauler");
    //
    // //Questions
    // await executeInference("Tour Eiffel r_lieu France"); //DUMP TOO BIG
    // await executeInference("piston r_holo voiture")
    //
    // await executeInference("tigre r_carac dangereux");
    // await executeInference("pigeon r_agent-1 pondre"); //DUMP TOO BIG
    // await executeInference("couper r_patient pain");
    // await executeInference("cuire r_patient steak");
    // await executeInference("découper r_patient poulet");
    // await executeInference("Airbus A380 r_agent-1 atterrir");
    // await executeInference("chat r_agent-1 miauler");
    // await executeInference("serveuse r_agent-1 apporter à boire");

    // Custom
    // await executeInference("vampire r_agent-1 sang");
    // await executeInference("tigre r_agent-1 dévorer");
    // await executeInference("chat de gouttière r_lieu toit");
    // await executeInference("hérisson r_lieu forêt");
    // await executeInference("hérisson r_holo forêt");
     /*executeInference("hérisson r_holo forêt").then(relations => {
        console.log(relations);
     })*/
}

main().then(r => console.log("Done"));


app.use(cors());

app.post("/", jsonParser, (req, res) => {
    console.log(req.body);
    console.log(req.body.type);
    switch(req.body.type) {
        case "further":
            console.log("further");
            console.log(req.body.relation);
            console.log(req.body.position);
            searchFurther(req.body.relation, req.body.position).then(relations => {
                res.send(relations);
            }).catch(err => {
                console.log(err.error);
                res.send({error: err.toString()});
            });
            break;
        case "inference":
            executeInference(req.body.sentence).then(relations => {
                res.send(relations);
            }).catch(err => {
                console.log(err.error);
                res.send({error: err.toString()});
            });
            break;
        default:
            res.send({error : "Unknown type"});
    }
});

app.listen(port, () => {
    console.log("Server started on port " + port);
});
