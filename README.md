# Inferator8000_JDM

## Sommaire
* **[Node.js](https://github.com/Tristan-T/Inferator8000_JDM/blob/master/README.md/#user-content-how-to-install-nodejs-on-your-machine)**
* **[Packages install](https://github.com/Tristan-T/Inferator8000_JDM/blob/master/README.md/#user-content-how-to-install-needed-packages-for-run-the-program)**
* **[Running](https://github.com/Tristan-T/Inferator8000_JDM/blob/master/README.md/#user-content-how-to-run-this-program)**


## How to install node.js on your machine
### Windows :
Download the LTS binaries : https://nodejs.org/dist/v16.15.0/node-v16.15.0-x64.msi and install

### Linux :
### /!\ The package inside the default repositories is **OUTDATED**. Only install from the Node.js official repositories /!\
````bash
wget -qO- https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
````

## How to install needed packages for run the program
Once npm is installed, go into the root of the project and run the following command :
````bash
npm install
````

## How to run this program
Simply start the server by running :
````bash
node index.js
````
Then open the file `index.html` in your browser.

## Additional functions
You can ask for an inference by typing "word relation word2" in the input of the browser.
You may also use your terminal to ask for an inference.
Simply add `await executeInference("word relation word2");` inside `main()` and run the program.

You can delete the cache by deleting the whole folder. It will be recreated the next time you run the program.

You can ask for further inferences by clicking the link of the relation you want to explore in your browser.