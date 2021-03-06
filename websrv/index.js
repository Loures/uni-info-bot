var express = require('express');
var formidable = require('formidable');
var bodyParser = require('body-parser');
var fs = require("fs");

var app = express();

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.get('/bot/appuntiA', function (req, res){
    res.sendFile(__dirname + '/index.html');
});
app.get('/bot/appuntiB', function (req, res){
    res.sendFile(__dirname + '/index2.html');
});

app.get('/bot/avvisi', function (req, res){
    res.sendFile(__dirname + '/avvisi.html');
});

app.use("/bot/appuntiA", express.static("./uploadsA/"));
app.use("/bot/appuntiB", express.static("./uploadsB/"));



app.post('/appuntiA', function (req, res){
    var form = new formidable.IncomingForm();

    form.parse(req);

    form.on('fileBegin', function (name, file){
        var exp = /(PRL|LPP|AM|MDAL|AIL|FIS)_\d\d\-\d\d-\d\d\.pdf/;
        if (exp.test(file.name)) {
            var match = exp.exec(file.name);
            file.path = __dirname + '/uploadsA/' + match[1] + "/" + file.name;
            res.sendFile(__dirname + '/index.html');
        } else {
            res.sendFile(__dirname + "/error.html");
            return;
        }
    });

    form.on('file', function (name, file) {});

});

app.post('/appuntiB', function (req, res){
    var form = new formidable.IncomingForm();

    form.parse(req);

    form.on('fileBegin', function (name, file){
        var exp = /(PRL|LPP|AM|MDAL|AIL|FIS)_\d\d\-\d\d-\d\d\.pdf/;
        if (exp.test(file.name)) {
            var match = exp.exec(file.name);
            file.path = __dirname + '/uploadsB/' + match[1] + "/" + file.name;
            res.sendFile(__dirname + '/index2.html');
        } else {
            res.sendFile(__dirname + "/error.html");
            return;
        }
    });

    form.on('file', function (name, file) {});

});

app.post("/avvisi", function(req, res) {
    var avvisi = JSON.parse(fs.readFileSync("./avvisi.json", {encoding: "utf8"}));
    if (/\d\d\/\d\d\/\d\d\d\d/.test(req.body.scadenza)) {
        req.body.added = (new Date()).getTime();
        avvisi.push(req.body);
        fs.writeFileSync("./avvisi.json", JSON.stringify(avvisi));
        res.sendFile(__dirname + "/avvisi.html")
    } else {
        res.sendFile(__dirname + "/error.html")
    }
})

app.listen(8080);
