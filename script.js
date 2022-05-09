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
            body: JSON.stringify({ sentence: sentence})
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
    inferenceContainer.innerHTML = '';

    //Sort data by weight
    data.sort(function (a, b) {
        return b.weight - a.weight;
    });

    //Loop through the data
    for(let inference of data) {
        //Create a new div
        let div = document.createElement('div');
        //Set the div's class
        div.className = 'inference';
        //Set the div's innerHTML
        let link1 = document.createElement('a');
        link1.innerHTML = inference.w1 + " " + inference.r1 + " " + inference.y + " ";
        link1.addEventListener('click', function () {
            requestInference(inference.w1 + " " + inference.r1 + " " + inference.y);
        });

        let link2 = document.createElement('a');
        link2.innerHTML = inference.r2 + " " + inference.w2 + " " + " (" + inference.weight + ")";
        link2.addEventListener('click', function () {
            requestInference(inference.y + " " + inference.r2 + " " + inference.w2);
        });

        let p = document.createElement('p');
        p.appendChild(link1);
        p.appendChild(link2);
        div.appendChild(p);

        //Append the div to the inference container
        inferenceContainer.appendChild(div);
    }
}