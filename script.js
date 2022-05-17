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
    //Clear the inference container
    //inferenceContainer.innerHTML = '';
    //Add br tag at the beginning of the container
    inferenceContainer.innerHTML += '<br>';
    //Loop through the data
    for(let inference of data) {
        //Create a new div
        let div = document.createElement('div');
        //Set the div's class
        div.className = 'inference';
        //Set the div's innerHTML
        let htmlString = "";
        for(let i = 0; i < inference.relations.length; i++) {
            let tempSpan = document.createElement('span');
            tempSpan.innerText = " " + inference.words[i] + " ";
            tempSpan.className = 'word';
            div.appendChild(tempSpan);
            let tempLink = document.createElement('a');
            tempLink.innerText = inference.relations[i];
            tempLink.href = '#';
            tempLink.className = 'relation';
            tempLink.addEventListener('click', function () {
                //requestInference(inference.relations[i]);
                alert("IL A CLIQUE SUR LE BOUTON LE BOUTON LE BOUTON LE BOUTON");
            });
            div.appendChild(tempLink);
        }
        let tempSpan = document.createElement('span');
        tempSpan.innerText = " " + inference.words[inference.relations.length];
        tempSpan.className = 'word';
        div.appendChild(tempSpan);

        //Append the div to the inference container
        inferenceContainer.appendChild(div);
    }
}