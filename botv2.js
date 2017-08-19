 //InfoBot v0.666

var request = require("request");
var util = require("util");
var TelegramBot = require("node-telegram-bot-api");
var fs = require("fs");
var Cron = require("cron");
var util = require("util");

//Fetch del GOA e manipolazione dati

var GOA = "";
var SETTINGS;
var notify = false;

if (!fs.existsSync("settings.json")) {
    fs.writeFileSync("settings.json", JSON.stringify({api: "", sysops: []}, null, "\t"));
    new Error("You need to edit settings.json in order to use this bot");
} else {
    SETTINGS = JSON.parse(fs.readFileSync("settings.json", {encoding: "utf8"}));
}


request.get("http://margot.di.unipi.it/test9/goa/2016/2/gettimetable/Informatica", function(_, _, body) {GOA = JSON.parse(body); GOA = formatGoa(GOA); load();})

function Lezione() {}

Lezione.prototype.deepEqual = function(l) {
    for (prop in this) {
        for(prop1 in l) {
            if (this[prop] != l[prop1]) return false;
        }
    }
    return true
}

Lezione.prototype.filter = function(anno, corso) {
    var name = this.name;
    if (anni[anno].some(function(a) {return a.test(name)})) {
        if ((/[AB]/).test(name.charAt(name.length - 1)) && name.charAt(name.length - 1) == corso.toUpperCase()) {
            return true;
        }
        if (!((/[AB]/).test(name.charAt(name.length - 1)))) {
            return true;
        }
    }
}

Lezione.prototype.msgOut = function() {
    var end = (Number(this.time.match(/(\d+):\d+/).pop()) + Math.round(this.duration / 60)) + ":00"
    var str = "";
    str += this.name + "\n_" + this.teacher + "_\n*" + this.room.join(", ") + "\n" + this.time + " - " + end + "*";
    return str;
}

function toTitleCase(str){
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

intToDay = function(d) {
    switch (d) {
        case 1:
            return "Lunedì";
            break;
        case 2:
            return "Martedì";
            break;
        case 3:
            return "Mercoledì";
            break;
        case 4:
            return "Giovedì";
            break;
        case 5:
            return "Venerdì";
            break;
        case 6:
            return "Sabato";
            break;
        default:
            return 0;
    }
}

function formatGoa(GOA) { //fa un po' schifo ma il JSON di GOA fa tanto schifo :(
    var arr = []
    GOA.days.forEach(function(day) {
        //var d = dayToInt(day.name);
        arr[day.name] = []
        day.rooms.forEach(function(room) {
            if (room.lessons && room.lessons.length > 0) {
                room.lessons.forEach(function(lesson) {
                    if (lessonCheck(lesson, function(l) {return l.ownername == "INF-L"})) {
                        var skip = false;
                        for (prop in arr) {
                            arr[prop].forEach(function(l) {
                                if (l.id == lesson.id) {
                                    if (!l.room.includes(lesson.roomname) && l.time == lesson.time && l.day == lesson.day && lesson.roomname) {
                                        l.room.push(lesson.roomname);
                                        skip = true;
                                    } else {
                                        //skip = true;
                                    }
                                }
                            });
                        }
                        var lezione = new Lezione();
                        lezione.id = lesson.id;
                        lezione.name = lesson.name;
                        lezione.teacher = toTitleCase(lesson.teacher_name);
                        lezione.day = lesson.day;
                        lezione.time = lesson.time;
                        lezione.duration = lesson.duration;
                        lezione.room = [lesson.roomname];
                        if (!skip) {arr[day.name].push(lezione)};
                        skip = false;
                    }
                })
            }
        })
        arr[day.name].sort(function(a, b) {
            if (Number(a.time.match(/(\d+):\d\d/)[1]) < Number(b.time.match(/(\d+):\d\d/)[1])) {
                return -1;
            } else if (Number(a.time.match(/(\d+):\d\d/)[1]) > Number(b.time.match(/(\d+):\d\d/)[1])) {
                return 1;
            } else {return 0;}
        })
    })
    console.log(util.inspect(arr, {depth: null}));
    return arr;
}

function lessonCheck(l, f) {return f(l)}

function load() {
    caricaIscritti();
    startCron();
}

var bot = new TelegramBot(SETTINGS.api, {polling: true});

//const anni = [
//    [/Analisi matematica - [AB]/, /Programmazione I e laboratorio - [AB]/, /Logica per la programmazione - [AB]/],
//    [/Architettura degli elaboratori - [AB]/, /Calcolo delle probabilita' e statistica/, /Programmazione II - [AB]/, /Ricerca operativa - [AB]/],
//    [/Crittografia/, /Elementi di calcolabilita' e complessita'/, /Reti di calcolatori e laboratorio - [AB]/, /Programmazione di Interfacce/]
//];

const anni = [
    [/Algoritmica e laboratorio - [AB]/, /Fisica - [AB]/, /Matematica discreta e algebra lineare - [AB]/],
    [/Basi di dati - [AB]/, /Calcolo numerico - [AB]/, /Ingegneria del software - [AB]/, /Sistemi Operativi e laboratorio - [AB]/],
    [/Esperienze di programmazione/, /Gestione di reti/, /Introduzione all?Intelligenza Artificiale/, /Laboratorio di basi di dati/, /Sicurezza di Sistemi ICT/, /Sviluppo di Applicazioni Mobili/]
]

//Iscrizioni

var iscritti = [];

getIscritto = function(id) {
    var d = false;
    iscritti.forEach(function(i) {
        if (i.id == id) {
            d = i;
        }
    });
    return d;
}

function caricaIscritti() {
    if (fs.existsSync("iscritti.json")) {
        fs.readFile("iscritti.json", function(err, data) {iscritti = JSON.parse(data);})
    } else {
        salvaIscritti();
    }
}

function salvaIscritti() {
    fs.writeFile("iscritti.json", JSON.stringify(iscritti))
}

function Iscritto(id, anno, corso) {
    this.id = id;
    this.corso = corso;
    this.anno = anno;
    this.notifiche = 1;
    this.orarionotifiche = 8;
}

function Iscrivi(id, anno, corso) {
    if (!iscritti.some(function(i) {return i.id == id})) {
        iscritti.push(new Iscritto(id, anno, corso));
        salvaIscritti();
        return true;
    } else {return false}
}

function Disiscrivi(id, corso) {
    var r = false
    iscritti.forEach(function(i, index) {
        if (i.id == id) {
            iscritti.splice(index, 1);
            salvaIscritti();
            r = true
            //bot.sendMessage(id, "Ti sei disiscritto dal bot");
        }
    })
    return r;
}

function caricaAvvisi() {
    var AVVISI = JSON.parse(fs.readFileSync("./websrv/avvisi.json", {encoding: "utf8"}));
    AVVISI.forEach(function(avviso, index) {
        var match = /(\d\d)\/(\d\d)\/(\d\d\d\d)/.exec(avviso.scadenza);
        var datascadenza = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
        //console.log((new Date()).getTime(), datascadenza.getTime())
        if ((new Date()).getTime() > datascadenza.getTime()) {
            AVVISI.splice(index, 1);
            fs.writeFileSync("./websrv/avvisi.json", JSON.stringify(AVVISI));
        }
    });
    AVVISI.sort(function(a, b) {
        if (a.added < b.added) {
            return 1;
        } else {
            return -1;
        }
    });
    return AVVISI;
}

var AVVISI = caricaAvvisi();

//Statistiche iscritti e amministrazione

bot.onText(/\/stats/, function(msg) {
    if (SETTINGS.sysops.includes(String(msg.chat.id))) {
        var tot_iscritti = iscritti.length
        var corsob = [];
        corsob[0] = iscritti.filter(function(i) {return (i.anno == 1 && i.corso == "b")}).length;
        corsob[1] = iscritti.filter(function(i) {return (i.anno == 2 && i.corso == "b")}).length;
        corsob[2] = iscritti.filter(function(i) {return (i.anno == 3 && i.corso == "b")}).length;
        var corsoa = [];
        corsoa[0] = iscritti.filter(function(i) {return (i.anno == 1 && i.corso == "a")}).length;
        corsoa[1] = iscritti.filter(function(i) {return (i.anno == 2 && i.corso == "a")}).length;
        corsoa[2] = iscritti.filter(function(i) {return (i.anno == 3 && i.corso == "a")}).length;
        var st = "*Iscritti totali: *" + tot_iscritti + "\n\n";
        corsoa.forEach(function(n, i) {
            st += "*Corso A " + (i+1) + " anno: *" + n + "\n";
        });
        st += "\n"
        corsob.forEach(function(n, i) {
            st += "*Corso B " + (i+1) + " anno: *" + n + "\n";
        });
        bot.sendMessage(msg.chat.id, st, {parse_mode: "Markdown"});
    }
})

bot.onText(/\/notifyall/, function(msg) {
    if (SETTINGS.sysops.includes(String(msg.chat.id))) {
        notificaTutti();
    }
})

bot.onText(/\/updateavvisi/, function(msg) {
    if (SETTINGS.sysops.includes(String(msg.chat.id))) {
        AVVISI = caricaAvvisi();
    }
})

//Notifiche

var arrDays = ["lun", "mar", "mer", "gio", "ven"];

function notificaTutti() {
    salvaIscritti();
    AVVISI = caricaAvvisi();
    var date = new Date();
    var day = getLiteral(LITERALS.giorni_int, date.getDay());
    var hour = date.getHours();
    iscritti.forEach(function(i) {
        if (i.notifiche && i.orarionotifiche == hour) {
            var st = "";
            if (GOA[day].length > 0) {
                GOA[day].forEach(function(l) {
                    if (l.filter(i.anno - 1, i.corso)) {
                        st += l.msgOut() + "\n\n";
                    }
                })
                var obj = {};
                obj.parse_mode = "Markdown";
                st.length > 0 && bot.sendMessage(i.id, st, obj);
            }
        }
    })
}
function startCron() {
    var job2 = new Cron.CronJob("0 1 * * 1-5", function() {
        request.get("http://margot.di.unipi.it/test9/goa/2016/2/gettimetable/Informatica", function(_, _, body) {GOA = JSON.parse(body); GOA = formatGoa(GOA);})
    });
    if (notify) {
        var job = new Cron.CronJob("0 * * * 1-5", notificaTutti);
        job.start();
    }
    job2.start();
}

//Funzioni per i bottoni

const LITERALS = {
    anni: [
        ["Primo anno", 1],
        ["Secondo anno", 2],
        ["Terzo anno", 3]
    ],
    corsi: [
        ["Corso A", "A"],
        ["Corso B", "B"]
    ],
    giorni: [
        ["Lunedì", "Lun"],
        ["Martedì", "Mar"],
        ["Mercoledì", "Mer"],
        ["Giovedì", "Gio"],
        ["Venerdì", "Ven"]
    ],
    giorni_int: [
        ["Lun", 1],
        ["Mar", 2],
        ["Mer", 3],
        ["Gio", 4],
        ["Ven", 5]
    ],
    lezioni: [
        ["Analisi Matematica", "AM"],
        ["Programmazione I", "PRL"],
        ["Matematica Discreta e Algebra Lineare", "MDAL"],
        ["Fisica", "FIS"],
        ["Algoritmica e laboratorio", "AIL"]
    ],
    mesi: [
        ["Gennaio", "01"],
        ["Febbraio", "02"],
        ["Marzo", "03"],
        ["Aprile", "04"],
        ["Maggio", "05"],
        ["Giugno", "06"],
        ["Luglio", "07"],
        ["Agosto", "08"],
        ["Settembre", "09"],
        ["Ottobre", "10"],
        ["Novembre", "11"],
        ["Dicembre", "12"]
    ]
}

function getLiteral(scope, txt) {
    var r;
    scope.forEach(function(a) {
        return a.forEach(function(l, i) {
            if (l == txt) {
                r = a[(i == 0 ? 1 : 0)];
                return;
            }
        })
    })
    return r;
}

function stampaCorsi(id) {
    var data = percorso(id);
        var st = "";
        if (GOA[toTitleCase(data[0])] && GOA[toTitleCase(data[0])].length > 0) {
            GOA[toTitleCase(data[0])].forEach(function(l) {
                if (l.filter(data[1] - 1, data[2])) {
                    st += l.msgOut() + "\n\n";
                }
            })
            obj = buildKeyboard(opzioni.menu.trigger(id).bottoni)
            obj.parse_mode = "Markdown";
            bot.sendMessage(id, st || "Non ci sono lezioni " + getLiteral(LITERALS.giorni, data[0]).toLowerCase(), obj);
        }
}

function handleIscrizione(id) {
    var data = percorso(id);
        if (Iscrivi(id, data[1], data[2].toLowerCase())) {
            obj = buildKeyboard(opzioni.menu.trigger(id).bottoni)
            bot.sendMessage(id, "Ti sei iscritto al bot", obj)
        }
}

function percorso(id) {
    var corso = STATI[id].pop()[1];
    var anno = STATI[id].pop()[1];
    var giorno = STATI[id].pop()[1];
    return [getLiteral(LITERALS.giorni, giorno), getLiteral(LITERALS.anni, anno), getLiteral(LITERALS.corsi, corso)];
}

function buildKeyboard(arguments) {
    if (arguments.length < 0) return {};
    var obj = {
        reply_markup: {
        }
    }
    obj.reply_markup.keyboard = arguments.map(function(t) {return [{text: t}]})
    return obj
}

var STATI = [];
const startCmd = "/start"

function initStato(id, stato) {
    if (stato != startCmd) {
        var result = opzioni.menu.trigger(id, startCmd);
        bot.sendMessage(id, "Menù principale", buildKeyboard(result.bottoni));
        return false
    } else {
        STATI[id] = [["menu", "/start"]];
        return true
    }
}

function creaStato(id, stato, testo) {
    if (!STATI[id]) {
        return initStato(id, stato);
    } else {
        STATI[id].push([stato, testo]);
        return true
    }
}

function ultimoMsg(id, back) {
    back = back ? back + 1 : 1;
    return STATI[id][STATI[id].length - back][1];
}

function correggiInput(id, text) {
    if (id.test && true) {
        return id.test(text);
    }
    if (id.some && true) {
        return id.some(function(i) {return i.toLowerCase() == text.toLowerCase()});
    }
    return id == text;
}

//Triggers

bot.on("message", function(msg) {
    for (opzione in opzioni) {
        var op = opzioni[opzione];
        var esegui = false;
        if (correggiInput(op.id, msg.text)) {
            if (creaStato(msg.chat.id, opzione, msg.text))
                var primostato = STATI[msg.chat.id][1] ? STATI[msg.chat.id][1][0] : "";
                var result = op.trigger(msg.chat.id, primostato);
                if (result && result.bottoni && opzione != "menu") result.bottoni.push("Indietro");
                if (result) {
                    var obj = buildKeyboard(result.bottoni || opzioni.menu.trigger(msg.chat.id).bottoni);
                    obj.parse_mode = "Markdown";
                    bot.sendMessage(msg.chat.id, result.text, obj);
                }
            }
        }
    });

bot.onText(/Indietro/, function(msg, match) {
    var id = msg.chat.id;
    if (STATI[id] && STATI[id].length > 1) {
        var stato = STATI[id].pop();
        var last = STATI[id][STATI[id].length - 1][0]
        var result = opzioni[last].trigger(id, stato[0] == "lezione" ? "appunti" : null);
        if (last != "menu") result.bottoni.push("Indietro");
        var obj = buildKeyboard(result.bottoni);
        obj.parse_mode = "Markdown";
        bot.sendMessage(msg.chat.id, result.text, obj);
    }
})

//Dati bottoni

var opzioni = {};

function Opzione(id, text) {
    this.id = id;
    this.text = text;
}

function handleAppunti(id, trigger) {
    var corso = percorso(id)[2];
        var obj = buildKeyboard();
        bot.sendMessage(id, "Quale corso ti interessa?", obj)
}

Opzione.prototype.trigger = function(id, text) {return this.funzione(id, text)}

//menu principale
opzioni.menu = new Opzione("/start", "Menù principale");
opzioni.menu.funzione = function(id, trigger) {
    initStato(id, this.id);
    var bottoni = [];
    var iscrittoData = false;
    if (iscritti.some(function(i) {if (i.id == id) {iscrittoData = i; return true}})) {
        bottoni.push("Orario odierno [" + getLiteral(LITERALS.anni, iscrittoData.anno) + ", " + getLiteral(LITERALS.corsi, iscrittoData.corso.toUpperCase()) + "]");
    }
    bottoni.push("Orario");
    bottoni.push("Appunti");
    bottoni.push("Avvisi");
    !iscrittoData && bottoni.push("Iscriviti");
    iscrittoData && bottoni.push("Impostazioni");
    bottoni.push("Informazioni");
    return {text: this.text, bottoni: bottoni}
}

//avvisi

opzioni.avvisi = new Opzione("Avvisi");
opzioni.avvisi.funzione = function(id) {
    var bottoni = [];
    if (AVVISI.length > 0) {
        AVVISI.forEach(function(avviso) {
            bottoni.push("AVVISO: " + avviso.nome);
        })
        return {text: "Lista degli avvisi", bottoni: bottoni}
    } else {
        return {text: "Non ci sono avvisi"}
    }
}

opzioni.stampavviso = new Opzione(/^AVVISO\: .+/);
opzioni.stampavviso.funzione = function(id, trigger) {
    var testo;
    if (trigger == "avvisi") {
        AVVISI.forEach(function(avviso) {
            if ("AVVISO: " + avviso.nome == ultimoMsg(id)) {
                testo= avviso.testo;
            }
        })
        return {text: testo};
    }

}

//Impostazioni

opzioni.impostazioni = new Opzione("Impostazioni", "Impostazioni per iscritti")
opzioni.impostazioni.funzione = function(id) {
    var bottoni = [];
    var iscritto = getIscritto(id);
    bottoni.push(iscritto.notifiche ? "Notifica [ON]" : "Notifica [OFF]");
    iscritto.notifiche && bottoni.push("Cambia orario notifica");
    bottoni.push("Disiscriviti")
    return {text: this.text, bottoni: bottoni};
}

//Trigger

opzioni.editnotifica = new Opzione(/Notifica \[(ON|OFF)\]/);
opzioni.editnotifica.funzione = function(id) {
    var text;
    var msg = ultimoMsg(id)
    var n = (/Notifica \[(ON|OFF)\]/.exec(msg))[1];
    switch (n) {
        case "ON":
            getIscritto(id).notifiche = 0;
            salvaIscritti();
            return {text: "Hai disattivato le notifiche"}
            break;
        case "OFF":
            getIscritto(id).notifiche = 1;
            salvaIscritti();
            return {text: "Hai attivato le notifiche"}
            break;
    }
}

opzioni.orarionotifica = new Opzione("Cambia orario notifica");
opzioni.orarionotifica.funzione = function(id) {
    var bottoni = [];
    var iscritto = getIscritto(id);
    for (var i = 7; i < 17; i++) {
        bottoni.push(String(i) + ":00");
    }
    return {text: "Il tuo orario di notifica è impostato per le *" + iscritto.orarionotifiche + ":00*", bottoni: bottoni};
}

opzioni.cambiaorario = new Opzione(/(\d+):00/);
opzioni.cambiaorario.funzione = function(id) {
    var ora = Number(this.id.exec(ultimoMsg(id))[1]);
    if (ora < 17 && ora > 6) {
        getIscritto(id).orarionotifiche = ora;
        salvaIscritti();
        return {text: "Riceverai l'orario giornaliero alle *" + ora + ":00*"};
    }
}

opzioni.orario = new Opzione("Orario", "Quale giorno ti interessa?");
opzioni.orario.funzione = function(id, trigger) {
    return {text: this.text, bottoni: ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì"]};
}

opzioni.iscriviti = new Opzione("Iscriviti", "Che anno frequenti?");
opzioni.iscriviti.funzione = function(id, trigger) {
    return {text: this.text, bottoni: ["Primo anno", "Secondo anno", "Terzo anno"]};
}

//Giorni

opzioni.giorni = new Opzione(/(Lunedì|Martedì|Mercoledì|Giovedì|Venerdì)/, "Che anno frequenti?");
opzioni.giorni.funzione = function(id, trigger) {
    return {text: this.text, bottoni: ["Primo anno", "Secondo anno", "Terzo anno"]}
}

//Anno
opzioni.anno = new Opzione(["Primo anno", "Secondo anno", "Terzo anno"], "Quale corso ti interessa?");
opzioni.anno.funzione = function(id, trigger) {
    return {text: this.text, bottoni: ["Corso A", "Corso B"]}
}

//Corsi

opzioni.corsi = new Opzione(/Corso [AB]/);
opzioni.corsi.funzione = function(id, trigger) {
    switch (trigger) {
        case "orario":
        stampaCorsi(id)
        break;
        case "iscriviti":
        handleIscrizione(id);
        break;
        case "appunti":
        return {text: "Che lezione ti interessa?", bottoni: LITERALS.lezioni.map(function(el) {return el[0]})};
        break;
    }
}

opzioni.orariod = new Opzione(/Orario odierno \[(.+), (.+)\]/)
opzioni.orariod.funzione = function(id) {
    var day = getLiteral(LITERALS.giorni_int, (new Date()).getDay())
    var st = "";
    iscritti.forEach(function(i) {
        if (i.id == id) {
            if (GOA[day] && GOA[day].length > 0) {
                GOA[day].forEach(function(l) {
                    if (l.filter(i.anno - 1, i.corso)) {
                        st += l.msgOut() + "\n\n";
                    }
                })
            }
        }
    });
    return {text: st || "Non ci sono lezioni oggi"}
}

opzioni.disiscrizione = new Opzione("Disiscriviti");
opzioni.disiscrizione.funzione = function(id) {
    if (Disiscrivi(id)) return {text: "Ti sei disiscritto dal bot"}
}

opzioni.appunti = new Opzione("Appunti");
opzioni.appunti.funzione = function(id) {
    //bot.sendMessage(id, "*Cerchiamo uno studente per caricare appunti per il corso B\nContattare *@AlexArrig* o *@loures96* per maggiori informazioni*", {parse_mode: "Markdown"});
    return {text: "Che corso ti interessa?", bottoni: ["Corso A", "Corso B"]};
}

opzioni.lezione = new Opzione(LITERALS.lezioni.map(function(el) {return el[0]}))
opzioni.lezione.funzione = function(id, trigger) {
    var bottoni = [];
    var lez = ultimoMsg(id)
    var corso = ultimoMsg(id, 1).charAt(ultimoMsg(id, 1).length - 1);
    var files = fs.readdirSync("./websrv/uploads" + corso + "/" + getLiteral(LITERALS.lezioni, lez))
    var exp = /(PRL|LPP|AM|MDAL|AIL|FIS)_(\d\d)\-(\d\d)-(\d\d)\.pdf/;
    files.sort(function(a, b) { //è la cosa più brutta del mondo ma whatever
        var match = exp.exec(a);
        var giorno = match[2];
        var mese = match[3];
        var anno = match[4];
        var sta = Number(anno + mese + giorno);
        match = exp.exec(b);
        var giornob = match[2];
        var meseb = match[3];
        var annob = match[4];
        var stb = Number(annob + meseb + giornob);
        if (sta > stb) {
            return -1;
        } else {return 1}
    })
    if (files.length <= 0) {return {text: "Non ci sono appunti per questo corso"}};
    files.forEach(function(name) {
        var match = exp.exec(name);
        bottoni.push(match[2] + " " + getLiteral(LITERALS.mesi, match[3]) + " 20" + match[4]);
    })
    return {text: "Scegli un giorno", bottoni: bottoni};
}

opzioni.fetchAppunti = new Opzione(/(\d\d) (Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre) 20(\d\d)/);
opzioni.fetchAppunti.funzione = function(id) {
    var corso = ultimoMsg(id, 2).charAt(ultimoMsg(id, 2).length - 1);
    var match = /(\d\d) (Gennaio|Febbraio|Marzo|Aprile|Maggio|Giugno|Luglio|Agosto|Settembre|Ottobre|Novembre|Dicembre) 20(\d\d)/.exec(ultimoMsg(id));
    var sigla = getLiteral(LITERALS.lezioni, ultimoMsg(id, 1));
    var obj = buildKeyboard(opzioni.menu.trigger(id).bottoni)
    obj.parse_mode = "Markdown";
    bot.sendDocument(id, "./websrv/uploads" + corso + "/" + sigla + "/" + (sigla + "_" + match[1] + "-" + getLiteral(LITERALS.mesi, match[2]) + "-" + match[3] + ".pdf"), obj);
}

opzioni.informazioni = new Opzione("Informazioni");
opzioni.informazioni.funzione = function(id) {
    return {text: "Per problemi, segnalazioni o suggerimenti contattare @AlexArrig o @loures96\nIn caso di bug digitare /start\n\nScritto in node.js da @loures96\nAppunti e hosting da @AlexArrig"}
}
