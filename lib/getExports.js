"use strict";

var
  Map = require("es6-map"),
  Set = require("es6-set"),
  parse = require("./parse"),
  resolve = require("./resolve");

var exportCache = new Map();

function getExports(path) {

  var exportMap = exportCache.get(path);
  if (exportMap != null) return exportMap;

  exportMap = ExportMap.forPath(path);

  exportCache.set(path, exportMap);

  // Object.freeze(exportMap);
  // Object.freeze(exportMap.named);

  return exportMap;

};

function ExportMap() {
  this.hasDefault = false
  this.named = new Set();

  this.isCommon = false;
}

ExportMap.forPath = function (path) {
  var m = new ExportMap();

  parse(path).body.forEach(function (n) {
    m.captureDefault(n);
    m.captureAll(n, path);
    m.captureNamedDeclaration(n);
    m.commonJs(n);
  });

  return m;
}

ExportMap.prototype.captureDefault = function (n) {
  if (n.type !== "ExportDefaultDeclaration") return;

  this.hasDefault = true;
}

ExportMap.prototype.captureAll = function (n, path) {
  if (n.type !== "ExportAllDeclaration") return;

  var deepPath = resolve(n.source.value, path);
  if (deepPath == null) return;

  var remoteMap = getExports(deepPath);
  remoteMap.named.forEach(function (name) { this.named.add(name); }.bind(this));
}

ExportMap.prototype.captureNamedDeclaration = function (n) {
  if (n.type !== "ExportNamedDeclaration") return;

  // capture declaration
  if (n.declaration != null){
    switch (n.declaration.type) {
      case "FunctionDeclaration":
      case "ClassDeclaration":
        this.named.add(n.declaration.id.name);
        break;
      case "VariableDeclaration":
        n.declaration.declarations.forEach(function (d) {
          this.named.add(d.id.name);
        }.bind(this));
        break;
    }
  }

  // capture specifiers
  n.specifiers.forEach(function (s) {
    this.named.add(s.exported.name);
  }.bind(this));
}

// todo: capture names
ExportMap.prototype.commonJs = function (n) {
  if (this.isCommon) return;

  if (n.type !== "ExpressionStatement") return;
  var expr = n.expression;

  if (expr.type !== "AssignmentExpression") return;

  if (expr.operator !== "=") return;
  if (expr.left.type !== "MemberExpression") return;

  if (expr.left.object.type !== "Identifier") return;

  if (expr.left.object.name === "module" || expr.left.object.name === "exports") {
    this.isCommon = true;
  }
}

module.exports = getExports;