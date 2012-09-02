(function() {
  var modules = {};
  function require(mod) {
    return modules[mod];
  }
  modules["debug"] = function() {};
  modules["css-parse"] = function() {
    var module = {};
    var debug = require("debug")("css-parse");
    module.exports = function(css) {
      function stylesheet() {
        return {
          stylesheet: {
            rules: rules()
          }
        };
      }
      function open() {
        return match(/^{\s*/);
      }
      function close() {
        return match(/^}\s*/);
      }
      function rules() {
        var node;
        var rules = [];
        whitespace();
        comments();
        while (css[0] != "}" && (node = atrule() || rule())) {
          comments();
          rules.push(node);
        }
        return rules;
      }
      function match(re) {
        var m = re.exec(css);
        if (!m) return;
        css = css.slice(m[0].length);
        return m;
      }
      function whitespace() {
        match(/^\s*/);
      }
      function comments() {
        while (comment()) ;
      }
      function comment() {
        if ("/" == css[0] && "*" == css[1]) {
          var i = 2;
          while ("*" != css[i] && "/" != css[i + 1]) ++i;
          i += 2;
          css = css.slice(i);
          whitespace();
          return true;
        }
      }
      function selector() {
        var m = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|[^{])+)/);
        if (!m) return;
        var matches = m[0].trim().match(/((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|[^,])+)/g);
        for (var i = 0, len = matches.length; i < len; ++i) {
          matches[i] = matches[i].trim();
        }
        return matches;
      }
      function declaration() {
        var prop = match(/^(\*?[-\w]+)\s*/);
        if (!prop) return;
        prop = prop[0];
        if (!match(/^:\s*/)) return;
        var val = match(/^((?:'(?:\\'|.)*?'|"(?:\\"|.)*?"|\([^\)]*?\)|[^};])+)\s*/);
        if (!val) return;
        val = val[0].trim();
        match(/^[;\s]*/);
        return {
          property: prop,
          value: val
        };
      }
      function keyframe() {
        var m;
        var vals = [];
        while (m = match(/^(from|to|\d+%)\s*/)) {
          vals.push(m[1]);
          match(/^,\s*/);
        }
        if (!vals.length) return;
        return {
          values: vals,
          declarations: declarations()
        };
      }
      function keyframes() {
        var m = match(/^@([-\w]+)?keyframes */);
        if (!m) return;
        var vendor = m[1];
        var m = match(/^([-\w]+)\s*/);
        if (!m) return;
        var name = m[1];
        if (!open()) return;
        comments();
        var frame;
        var frames = [];
        while (frame = keyframe()) {
          frames.push(frame);
          comments();
        }
        if (!close()) return;
        return {
          name: name,
          vendor: vendor,
          keyframes: frames
        };
      }
      function media() {
        var m = match(/^@media *([^{]+)/);
        if (!m) return;
        var media = m[1].trim();
        if (!open()) return;
        comments();
        var style = rules();
        if (!close()) return;
        return {
          media: media,
          rules: style
        };
      }
      function atimport() {
        var m = match(/^@import *([^;\n]+);\s*/);
        if (!m) return;
        return {
          "import": m[1].trim()
        };
      }
      function declarations() {
        var decls = [];
        if (!open()) return;
        comments();
        var decl;
        while (decl = declaration()) {
          decls.push(decl);
          comments();
        }
        if (!close()) return;
        return decls;
      }
      function atrule() {
        return keyframes() || media() || atimport();
      }
      function rule() {
        var sel = selector();
        if (!sel) return;
        comments();
        return {
          selectors: sel,
          declarations: declarations()
        };
      }
      return stylesheet();
    };
    return module.exports;
  }();
  modules["css-stringify"] = function() {
    var module = {};
    module.exports = function(node, options) {
      return (new Compiler(options)).compile(node);
      return options.compress ? node.stylesheet.rules.map(visit(options)).join("") : node.stylesheet.rules.map(visit(options)).join("\n\n");
    };
    function Compiler(options) {
      options = options || {};
      this.compress = options.compress;
    }
    Compiler.prototype.compile = function(node) {
      return node.stylesheet.rules.map(this.visit.bind(this)).join(this.compress ? "" : "\n\n");
    };
    Compiler.prototype.visit = function(node) {
      if (node.keyframes) return this.keyframes(node);
      if (node.media) return this.media(node);
      if (node.import) return this.import(node);
      return this.rule(node);
    };
    Compiler.prototype.import = function(node) {
      return "@import " + node.import + ";";
    };
    Compiler.prototype.media = function(node) {
      var self = this;
      if (this.compress) {
        return "@media " + node.media + "{" + node.rules.map(this.visit.bind(this)).join("") + "}";
      }
      return "@media " + node.media + " {\n" + node.rules.map(function(node) {
        return "  " + self.visit(node);
      }).join("\n\n") + "\n}";
    };
    Compiler.prototype.keyframes = function(node) {
      if (this.compress) {
        return "@" + (node.vendor || "") + "keyframes " + node.name + "{" + node.keyframes.map(this.keyframe.bind(this)).join("") + "}";
      }
      return "@" + (node.vendor || "") + "keyframes " + node.name + " {\n" + node.keyframes.map(this.keyframe.bind(this)).join("\n") + "}";
    };
    Compiler.prototype.keyframe = function(node) {
      var self = this;
      if (this.compress) {
        return node.values.join(",") + "{" + node.declarations.map(this.declaration.bind(this)).join(";") + "}";
      }
      return "  " + node.values.join(", ") + " {\n" + node.declarations.map(function(node) {
        return "  " + self.declaration(node);
      }).join(";\n") + "\n  }\n";
    };
    Compiler.prototype.rule = function(node) {
      if (this.compress) {
        return node.selectors.join(",") + "{" + node.declarations.map(this.declaration.bind(this)).join(";") + "}";
      }
      return node.selectors.join(",\n") + " {\n" + node.declarations.map(this.declaration.bind(this)).join(";\n") + "\n}";
    };
    Compiler.prototype.declaration = function(node) {
      if (this.compress) {
        return node.property + ":" + node.value;
      }
      return "  " + node.property + ": " + node.value;
    };
    return module.exports;
  }();
  modules["css-condense"] = function() {
    var module = {};
    function compress(str, options) {
      options || (options = {});
      var css = {
        parse: require("css-parse"),
        stringify: require("css-stringify")
      };
      if (options.safe === true) {
        options.consolidateMediaQueries = false;
        options.consolidateViaSelectors = false;
        options.consolidateViaDefinitions = false;
      }
      if (options.sort === false) {
        options.sortSelectors = false;
        options.sortDeclarations = false;
      }
      return compressCode(str);
      function compressCode(str) {
        var parts = getBangComments(str);
        str = parts.code;
        var i = 0;
        str = str.replace(/\/\*[\s\S]*?\\\*\/([\s\S]+?)\/\*[\s\S]*?\*\//g, function(content) {
          return "#x" + i + "ie5machack{start:1}" + content + "#x" + ++i + "ie5machack{end:1}";
        });
        str = stripComments(str);
        var tree = css.parse(str);
        transform(tree);
        var output;
        if (options.compress === false) {
          output = css.stringify(tree).trim();
        } else {
          output = css.stringify(tree, {
            compress: true
          });
        }
        output = output.replace(/\s*#x[0-9]+ie5machack{start:1}\s*/g, "/*\\*/").replace(/\s*#x[0-9]+ie5machack{end:1}\s*/g, "/**/");
        if (options.lineBreaks === true) {
          output = output.replace(/}/g, "}\n");
        }
        output = parts.comments.join("") + output;
        return output;
      }
      function transform(tree) {
        context(tree.stylesheet);
      }
      function context(tree) {
        var mediaCache = {};
        var valueCache = {};
        var selectorCache = {};
        tree.rules.forEach(function(rule, i) {
          if (typeof rule.media !== "undefined") {
            consolidateMediaQueries(rule, tree.rules, i, mediaCache);
          }
          if (typeof rule.declarations !== "undefined") {
            styleRule(rule, tree.rules, i);
            consolidateViaDeclarations(rule, tree.rules, i, valueCache);
          }
        });
        tree.rules.forEach(function(rule, i) {
          if (typeof rule.declarations !== "undefined") {
            consolidateViaSelectors(rule, tree.rules, i, selectorCache);
          }
        });
        valueCache = {};
        tree.rules.forEach(function(rule, i) {
          if (typeof rule.declarations !== "undefined") {
            consolidateViaDeclarations(rule, tree.rules, i, valueCache);
            rule.selectors = undupeSelectors(rule.selectors);
          }
          if (typeof rule.media !== "undefined") {
            rule = context(rule);
          }
          if (typeof rule.keyframes !== "undefined") {
            rule.keyframes.forEach(function(keyframe, i) {
              styleRule(keyframe, rule.keyframes, i);
            });
          }
        });
        return tree;
      }
      function undupeSelectors(selectors) {
        var cache = {}, output = [];
        selectors.forEach(function(selector) {
          if (!cache[selector]) {
            cache[selector] = true;
            output.push(selector);
          }
        });
        return output;
      }
      function sortSelectors(selectors) {
        if (options.sortSelectors === false) return selectors;
        if (selectors.length <= 1) return selectors;
        return selectors.sort();
      }
      function sortDeclarations(declarations) {
        if (options.sortDeclarations === false) return declarations;
        if (declarations.length <= 1) return declarations;
        declarations.forEach(function(decl, i) {
          decl.index = i;
        });
        return declarations.sort(function(a, b) {
          function toIndex(decl) {
            var prop = decl.property;
            if (m = prop.match(/^(\-[a-z]+\-|\*|_)(.*)$/)) {
              prop = m[2];
            }
            return prop + "-" + (1e3 + decl.index);
          }
          return toIndex(a) > toIndex(b) ? 1 : -1;
        });
      }
      function consolidateViaDeclarations(rule, context, i, cache) {
        if (options.consolidateViaDeclarations === false) return;
        consolidate("selectors", "declarations", "last", rule, context, i, cache);
        rule.selectors = sortSelectors(rule.selectors);
      }
      function consolidateViaSelectors(rule, context, i, cache) {
        if (options.consolidateViaSelectors === false) return;
        consolidate("declarations", "selectors", "last", rule, context, i, cache);
        rule.declarations = sortDeclarations(rule.declarations);
      }
      function consolidateMediaQueries(rule, context, i, cache) {
        if (options.consolidateMediaQueries === false) return;
        consolidate("rules", "media", "last", rule, context, i, cache);
      }
      function consolidate(what, via, direction, rule, context, i, cache) {
        var value = JSON.stringify(rule[via]);
        if (direction == "first") {
          if (typeof cache[value] !== "undefined") {
            cache[value][what] = cache[value][what].concat(rule[what]);
            delete context[i];
          } else {
            cache[value] = rule;
          }
        } else {
          if (typeof cache[value] !== "undefined") {
            var last = cache[value];
            rule[what] = last.rule[what].concat(rule[what]);
            delete context[last.index];
          }
          cache[value] = {
            rule: rule,
            index: i
          };
        }
      }
      function styleRule(rule, context, i) {
        if (rule.declarations.length === 0) {
          delete context[i];
          return;
        }
        if (typeof rule.selectors !== "undefined") {
          rule.selectors = sortSelectors(rule.selectors.map(compressSelector));
        }
        rule.declarations = sortDeclarations(rule.declarations);
        rule.declarations.forEach(function(declaration) {
          compressDeclaration(declaration);
        });
        return rule;
      }
      function compressDeclaration(declaration) {
        var self = this;
        var val;
        var values = valueSplit(declaration.property, declaration.value);
        values = values.map(function(identifier) {
          return compressIdentifier(identifier, declaration.property);
        });
        if (declaration.property === "margin" || declaration.property === "padding") {
          values = compressPadding(values);
        }
        if (declaration.property === "font-family") {
          val = values.join(",");
        } else {
          val = values.join(" ");
        }
        val = val.replace(/\s*!important$/, "!important");
        declaration.value = val;
        return declaration;
      }
      function compressIdentifier(identifier, property) {
        var m;
        if (identifier === "none" && (property === "background" || property === "border" || property === "outline")) {
          return "0";
        }
        if (m = identifier.match(/^url\(["'](.*?)["']\)$/)) {
          return "url(" + m[1] + ")";
        }
        if (m = identifier.match(/^(\.?[0-9]+|[0-9]+\.[0-9]+)?(em|px|%|in|cm|pt)$/)) {
          var num = m[1];
          var unit = m[2];
          if (num.match(/^0*\.?0*$/)) {
            return "0";
          } else {
            num = num.replace(/^0+/, "");
            if (num.indexOf(".") > -1) num = num.replace(/0+$/, "");
            return num + unit;
          }
        }
        if (identifier.match(/^#[0-9a-f]+$/)) {
          identifier = identifier.toLowerCase();
          if (identifier[1] === identifier[2] && identifier[3] === identifier[4] && identifier[5] === identifier[6]) {
            return "#" + identifier[1] + identifier[3] + identifier[5];
          } else {
            return identifier;
          }
        }
        return identifier;
      }
      function compressPadding(values) {
        if (values.length === 4 && values[0] === values[2] && values[1] === values[3]) {
          values = [ values[0], values[1] ];
        }
        if (values.length === 2 && values[0] === values[1]) {
          values = [ values[0] ];
        }
        return values;
      }
      function compressSelector(selector) {
        var re = selector;
        re = re.replace(/\s+/, " ");
        re = re.replace(/ ?([\+>~]) ?/, "$1");
        return re;
      }
      function valueSplit(prop, values) {
        var re;
        if (prop === "font-family") {
          re = values.split(",");
        } else {
          re = values.match(/"(?:\\"|.)*?"|'(?:\\'|.)*?'|[^ ]+/g);
        }
        re = re.map(function(s) {
          return s.trim();
        });
        if (prop === "font-family") {
          re = re.map(function(value) {
            if (value.charAt(0) === '"' || value.charAt(0) === "'") {
              value = value.substr(1, value.length - 2);
            }
            return value;
          });
        }
        return re;
      }
      function stripComments(str) {
        return str.replace(/\/\*[\s\S]*?\*\//g, "");
      }
      function getBangComments(str) {
        var comments = [];
        var code = str.replace(/\/\*![\s\S]*?\*\//g, function(str) {
          comments.push(str.trim() + "\n");
          return "";
        });
        return {
          comments: comments,
          code: code
        };
      }
    }
    module.exports = {
      compress: compress
    };
    return module.exports;
  }();
  this.CssCondense = modules["css-condense"];
})();