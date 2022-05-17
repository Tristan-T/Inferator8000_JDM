

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
});

function requestInference(sentence) {
    //Set value for the input
    document.getElementById('input').value = sentence;

    //Make post request to the local server
    (async () => {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "inference", sentence: sentence})
        };
        const response = await fetch('http://localhost:3000', requestOptions);
        const data = await response.json();
        fillInferences(data);
    })();
}

function requestFurther(relation, position) {
    //Make post request to the local server
    (async () => {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: "further", relation: relation, position: position})
        };
        const response = await fetch('http://localhost:3000', requestOptions);
        const data = await response.json();
        console.log(data);
        fillInferences(data);
    })();
}

function fillInferences(data) {
    console.log(data);
    if("error" in data) {
        //Display error with alert
        alert(data.error);
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
    //Set the text of the cell
    cellRelation.innerHTML = "Relation";
    let cellScoreCube = document.createElement('th');
    cellScoreCube.innerHTML = "Score Cube";
    cellScoreCube.className = "order-by-desc";
    let cellScore = document.createElement('th');
    cellScore.innerHTML = "Score Moyen";
    let cellScoreGeo = document.createElement('th');
    cellScoreGeo.innerHTML = "Score Géométrique";

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
    inferenceContainer.prepend(table);
}