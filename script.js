//When DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    //Get the submit button
    let submit = document.getElementById('submit');
    //Add event listener to the submit button
    submit.addEventListener('click', function () {
        //Get the input field
        let input = document.getElementById('input');
        //Get the value of the input field
        let value = input.value;
        requestInference(value);
    });

    //detect konami code
    let konamiCode = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let konamiCodeIndex = 0;
    document.addEventListener('keydown', function (event) {
        if (event.keyCode === konamiCode[konamiCodeIndex]) {
            konamiCodeIndex++;
            if (konamiCodeIndex === konamiCode.length) {
                konamiCodeIndex = 0;
                console.log("Konami code activated");
                //Redirect to rickroll
                window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
            }
        } else {
            konamiCodeIndex = 0;
        }
    });
});

document.addEventListener("click", function (event) {
    //Play modem.mp3
    let audio = document.getElementById('sound');
    let audioSource = document.getElementById('audioSource');
    audioSource.src = './img/welcome.mp3';
    audio.load();
    audio.play();
    //Destroy event listener
    document.removeEventListener("click", arguments.callee);
});

function playModem() {
    //Play modem.mp3
    let audio = document.getElementById('sound');
    let audioSource = document.getElementById('audioSource');
    audioSource.src = './img/modem.mp3';
    audio.load();
    audio.play();
}

function stopModem() {
    //Stop modem.mp3
    let audio = document.getElementById('sound');
    audio.pause();
    //Set back to beginning
    audio.currentTime = 0;
}

function playError() {
    //Play error.mp3
    let audio = document.getElementById('sound');
    let audioSource = document.getElementById('audioSource');
    audioSource.src = './img/error.mp3';
    audio.load();
    audio.play();
}

function requestInference(sentence) {
    playModem();
    //Set value for the input
    document.getElementById('input').value = sentence;

    //Make post request to the local server
    (async () => {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "inference", sentence: sentence})
        };
        const response = await fetch('http://inferator8000.torisu.fr:3000', requestOptions);
        const data = await response.json();
        fillInferences(data);
    })();
}

function requestFurther(relation, position) {
    playModem();
    //Make post request to the local server
    (async () => {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "further", relation: relation, position: position})
        };
        const response = await fetch('http://inferator8000.torisu.fr:3000', requestOptions);
        const data = await response.json();
        fillInferences(data);
    })();
}

function fillInferences(data) {
    stopModem();
    console.log("here")
    console.log(data);
    if("error" in data) {
        //Display error with alert
        playError();
        alert(data.error);
        //Change input class
        document.getElementById('groupform').classList.add("error");
    } else {
        document.getElementById('groupform').classList.remove("error");
    }

    //Get the inference container
    let inferenceContainer = document.getElementById('output');
    //Loop through the data
    let div = document.createElement('div');
    //Set the div's class
    div.className = 'inference';

    //Create a new table
    let table = document.createElement('table');
    table.className = 'sortable';
    //Create thead
    let thead = document.createElement('thead');
    //Create a new row
    let row = document.createElement('tr');
    //Create a new cell
    let cellRelation = document.createElement('th');
    cellRelation.className = 'no-sort';
    //Set the text of the cell
    cellRelation.innerHTML = "Relation";
    let cellScoreCube = document.createElement('th');
    cellScoreCube.innerHTML = "Score Cube";
    let cellScore = document.createElement('th');
    cellScore.innerHTML = "Score Moyen";
    let cellScoreGeo = document.createElement('th');
    cellScoreGeo.innerHTML = "Score Géo";

    cellScoreCube.addEventListener('click', function () {
        if(cellScoreCube.innerText === "Score Cube 🔼") {
            cellScoreCube.innerText = "Score Cube 🔽";
        } else {
            cellScoreCube.innerText = "Score Cube 🔼";
        }
    });

    cellScore.addEventListener('click', function () {
        if(cellScore.innerText === "Score Moyen 🔼") {
            cellScore.innerText = "Score Moyen 🔽";
        } else {
            cellScore.innerText = "Score Moyen 🔼";
        }
    });

    cellScoreGeo.addEventListener('click', function () {
        if(cellScoreGeo.innerText === "Score Géométrique 🔼") {
            cellScoreGeo.innerText = "Score Géométrique 🔽";
        } else {
            cellScoreGeo.innerText = "Score Géométrique 🔼";
        }
    });



    //Add the cell to the row
    row.appendChild(cellRelation);
    row.appendChild(cellScoreCube);
    row.appendChild(cellScore);
    row.appendChild(cellScoreGeo);
    //Add the row to the thead
    thead.appendChild(row);

    //Add the row to the table
    table.appendChild(thead);

    //Create tbody
    let tbody = document.createElement('tbody');

    for(let inference of data) {
        row = document.createElement('tr');
        cellRelation = document.createElement('td');
        for(let i = 0; i < inference.relations.length; i++) {
            let tempSpan = document.createElement('span');
            tempSpan.innerText = " " + inference.words[i] + " ";
            tempSpan.className = 'word';
            cellRelation.appendChild(tempSpan);
            let tempLink = document.createElement('a');
            tempLink.innerText = inference.relations[i];
            tempLink.className = 'relation';
            tempLink.addEventListener('click', function () {
                requestFurther(inference, i);
            });
            let tempWeight = document.createElement('span');
            tempWeight.innerText = " (" + inference.weights[i] + ")";
            tempWeight.className = 'weight';
            cellRelation.appendChild(tempLink);
            cellRelation.appendChild(tempWeight);
        }
        let tempSpan = document.createElement('span');
        tempSpan.innerText = " " + inference.words[inference.relations.length];
        tempSpan.className = 'word';
        let cellScoreCube = document.createElement('td');
        cellScoreCube.innerText = inference.scoreCube.toFixed(2);
        let cellScore = document.createElement('td');
        cellScore.innerText = inference.scoreMoy.toFixed(2);
        let cellScoreGeo = document.createElement('td');
        //Check that scoreGeo is not NaN
        if(!isNaN(inference.scoreGeo) && inference.scoreGeo!==null) {
            console.log(inference.scoreGeo);
            cellScoreGeo.innerText = inference.scoreGeo.toFixed(2);
        }

        //Add the cell to the row
        cellRelation.appendChild(tempSpan);
        row.appendChild(cellRelation);
        row.appendChild(cellScoreCube);
        row.appendChild(cellScore);
        row.appendChild(cellScoreGeo);
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    //Append the div to the inference container
    div.appendChild(table);
    inferenceContainer.prepend(div);
}
