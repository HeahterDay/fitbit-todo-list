import document from "document";
import * as fs from "fs";
import { me as device } from "device";
import { battery } from "power";
import { inbox } from "file-transfer";
import * as cbor from "cbor";

let VTList = document.getElementById('my-tile-list');
let emptyListHelp = document.getElementById('emptyListHelp');
let timeOfDay = document.getElementById("timeOfDay");
let appTitle = document.getElementById("appTitle");
let batteryIcon = document.getElementById("batteryIcon");
let batteryPercent = document.getElementById("battery");
let batteryOverlay = document.getElementById("batteryIconOverlay");
let batteryRedLine = document.getElementById("batteryRedLine");

const IONIC = "IONIC";

if (device.modelName.toUpperCase() === IONIC) {
  timeOfDay.y = 20;
  appTitle.y = 20;
  batteryPercent.y = 20;
  batteryIcon.y = 3;
  batteryIcon.height = 22;
  batteryOverlay.height = 12;
  batteryRedLine.y = 8;
  batteryRedLine.height = 12;
}

function updateHeader() {
  let batteryLevel = battery.chargeLevel;
  batteryPercent.text = batteryLevel + "%";
  let batteryWidth = Math.round((100 - batteryLevel) * 0.24);
  batteryOverlay.width = batteryWidth;
  batteryOverlay.x = 31 - batteryWidth;

  if (batteryLevel > 10) {
    batteryRedLine.style.display = "none";
  } else {
    batteryRedLine.style.display = "inline";
  }

  let today = new Date();
  let hours = today.getHours();
  let minutes = today.getMinutes();
  let seconds = today.getSeconds();
  minutes = minutes > 9 ? minutes : (minutes > 0 ? "0" + minutes : "00");
  let suffix = hours >= 12 ? " PM" : " AM";
  hours = ((hours + 11) % 12 + 1);
  let time = hours + ":" + minutes + suffix;
  timeOfDay.text = time;
  setTimeout(updateHeader, (60 - seconds) * 1000);
}

updateHeader();

// Colors
let itemColor = "#2490dd";
//let NUM_COLORS = 2;
let itemCheckedColor = "#303030";
let itemUncheckedColor = "#ffffff";
let checkedState = [];
let checkedStateMap = {};


/**************************************************
                  LIST RENDERING
 *************************************************/
let populateList = function (listData) {
    if (listData.length === 0) {
        emptyListHelp.style.display = "inline";
    }
    else {
        emptyListHelp.style.display = "none";
    }
    var NUM_ELEMS = listData.length;
    if (checkedState.length !== listData.length) {
        mergeNewLoadedListWithStoredList(listData);
    }
    var jsonListState = {
        "listData": listData,
        "checkedState": checkedState
    };
    fs.writeFileSync("listState.txt", jsonListState, "json");
    try {
        var stats = fs.statSync("listState.txt");
        var storedListState = fs.readFileSync("listState.txt", "json");
    }
    catch (err) {
    }
    VTList.delegate = {
        getTileInfo: function (index) {
            var tile_type = "colour-pool";
            return { type: tile_type,
                color: itemColor, //s[index % NUM_COLORS],
                index: index, };
        },
        configureTile: function (tile, info) {
            if (info.type == 'colour-pool') {
                tile.getElementById('bg').style.fill = info.color;
                tile.getElementById('title-text').text = listData[info.index]["name"];
                tile.index = info.index;
                var checkbox_1 = tile.getElementById('checkbox');
                var titletext_1 = tile.getElementById('title-text');
                var listNumber = tile.getElementById('listNumber');
                listNumber.text = tile.index + 1;
                checkbox_1.value = checkedState[info.index];
                titletext_1.style.fill = checkedState[info.index] === 0 ? itemUncheckedColor : itemCheckedColor;
                tile.getElementById('checkbox').onclick = function (event) {
                    if (checkbox_1.value === 0) {
                        checkedState[tile.index] = 1;
                        checkedStateMap[listData[tile.index]["name"]] = 1;
                        titletext_1.style.fill = itemCheckedColor;
                    }
                    else {
                        checkedState[tile.index] = 0;
                        checkedStateMap[listData[tile.index]["name"]] = 0;
                        titletext_1.style.fill = itemUncheckedColor;
                    }
                    jsonListState.checkedState = checkedState;
                    fs.writeFileSync("listState.txt", jsonListState, "json");
                };
                tile.onclick = function (event) {
                    if (checkbox_1.value === 0) {
                        checkbox_1.value = 1;
                        checkedState[tile.index] = 1;
                        checkedStateMap[listData[tile.index]["name"]] = 1;
                        titletext_1.style.fill = itemCheckedColor;
                    }
                    else {
                        checkbox_1.value = 0;
                        checkedState[tile.index] = 0;
                        checkedStateMap[listData[tile.index]["name"]] = 0;
                        titletext_1.style.fill = itemUncheckedColor;
                    }
                    jsonListState.checkedState = checkedState;
                    fs.writeFileSync("listState.txt", jsonListState, "json");
                };
            }
        },
    };
    VTList.length = NUM_ELEMS;
};

function createCheckedStateHashMap(listData) {
    for (var i = 0; i !== listData.length; i++) {
        checkedStateMap[listData[i]["name"]] = checkedState[i];
    }
}
function mergeNewLoadedListWithStoredList(listData) {
    var newCheckedState = [];
    var newCheckedStateMap = {};
    for (var i = 0; i !== listData.length; i++) {
        var key = listData[i]["name"];
        if (key in checkedStateMap) {
            newCheckedState.push(checkedStateMap[key]);
            newCheckedStateMap[key] = checkedStateMap[key];
        }
        else {
            newCheckedState.push(0);
            newCheckedStateMap[key] = 0;
        }
    }
    checkedState = newCheckedState;
    checkedStateMap = newCheckedStateMap;
}
try {
    var stats = fs.statSync("listState.txt");
    var storedListState = fs.readFileSync("listState.txt", "json");
    if (storedListState.listData !== undefined && storedListState.listData.length !== 0) {
        checkedState = storedListState.checkedState;
        createCheckedStateHashMap(storedListState.listData);
        populateList(storedListState.listData);
    }
}
catch (err) {
    var jsonListState = { "listData": [], "checkedState": [] };
    fs.writeFileSync("listState.txt", jsonListState, "json");
    var storedListData = fs.readFileSync("listState.txt", "json");
}
var lastProcessedSettingTime = 0;
function loadTodos() {
    try {
        var todos = fs.readFileSync("todoItems.cbor", "cbor");
        if (lastProcessedSettingTime < todos.timestamp) {
            lastProcessedSettingTime = todos.timestamp;
            if (todos.todo !== undefined & todos.todo.length !== undefined) {
                populateList(todos.todo);
            }
        }
    }
    catch (err) {
    }
}

function processInbox() {
    let fileName;
    while (fileName = inbox.nextFile()) {
        if (fileName === 'todoItems.cbor') {
            loadTodos();
        }
    }
}

inbox.onnewfile = processInbox;
processInbox();