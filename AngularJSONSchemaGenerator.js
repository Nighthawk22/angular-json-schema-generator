'use strict';

(function(window, angular, undefined) {'use strict';
    angular.module('ngSchemaGenerator', ['ng']).
        service('SchemaGenerator', [ function() {

            var generate = function(json) {
                var ast = new AST();
                var compiler = new Compiler();
                ast.build(json);
                compiler.compile(ast.tree);

                return compiler.schema;
            };
            var utils = {};
            utils.isObject = function(value) {
                return (null !== value && typeof value === typeof {} && !utils.isArray(value));
            };

            utils.isNumber = function(value) {
                return !utils.isArray( value ) && (value - parseFloat( value ) + 1) >= 0;
            };

            utils.isArray = function(value) {
                return (value instanceof Array);
            };

            utils.isString = function(value) {
                return (typeof value === typeof '');
            };

            utils.isNull = function(value) {
                return (null === value);
            };

            utils.isBoolean = function(value) {
                return (value === true || value === false);
            };

            utils.toObject = function(arr) {
                var rv = {};
                for (var i = 0; i < arr.length; ++i)
                    rv[i] = arr[i];
                return rv;
            };

            utils.oneIsNull = function(v1, v2) {
                return ((v1 === null && v2 !== null) || (v1 !== null && v2 === null));
            };

            utils.isUndefined = function(val) {
                return (null === val || typeof val === 'undefined');
            };

            utils.isFunction = function(fn) {
                return (typeof fn === 'function');
            };

            utils.isEqual = function(v1, v2) {
                if (typeof v1 !== typeof v2 || utils.oneIsNull(v1, v2)) {
                    return false;
                }

                if (typeof v1 === typeof "" || typeof v1 === typeof 0) {
                    return v1 === v2;
                }

                var _isEqual = true;

                if (typeof v1 === typeof {}) {
                    var compare = function(value1, value2) {
                        for (var i in value1) {
                            if (!value2.hasOwnProperty(i)) {
                                _isEqual = false;
                                break;
                            }

                            if (utils.isObject(value1[i])) {
                                compare(value1[i], value2[i]);
                            } else if (typeof value1[i] === typeof "") {
                                if (value1[i] !== value2[i]) {
                                    _isEqual = false;
                                    break;
                                }
                            }
                        }
                    };

                    compare(v1, v2);
                }

                return _isEqual;
            };

            utils.getType = function(data) {
                if (utils.isObject(data)) {
                    return 'object';
                } else if (utils.isArray(data)) {
                    return 'array';
                } else if (utils.isNull(data)) {
                    return null;
                } else if (utils.isBoolean(data)) {
                    return 'boolean';
                } else if (utils.isString(data)) {
                    return 'string';
                } else if (utils.isNumber(data)) {
                    return 'number';
                }
            };



            var AST = function() {
                if (!this instanceof AST) {
                    return new AST();
                }

                this.tree = {};
            };

            /**
             Computes the hex hash of the given value
             @method generateHash
             @param {Mixed} value Value to hash
             @return {String} HEX value.
             */
            AST.prototype.generateHash = function(value) {
                if (utils.isObject(value)) {
                    var keys = Object.keys(value);
                    return crypto.createHash("md5").update(JSON.stringify(keys)).digest("hex");
                } else if (utils.Array(value)) {
                    return crypto.createHash("md5").update(JSON.stringify(value)).digest("hex");
                } else {
                    return crypto.createHash("md5").update(value).digest("hex");
                }
            };

            /**
             Checks if the elements in the given node are all
             equal.
             @method isAllSimilarObject
             @param {Object} node JSON node to inspect
             @return {Object}
             */
            AST.prototype.isAllSimilarObjects = function(node) {
                var hashes = [];
                var max = 0;
                var selected = null;
                for (var i in node) {
                    var hash = this.generateHash(node[i]);
                    hashes[hash] = true;
                    var keys = Object.keys(node[i]);
                    if (!max || keys.length > max) {
                        max = keys.length;
                        selected = node[i];
                    }
                }

                return {same: (hashes.length === 1), selected: selected};
            };

            /**
             Inspect primitatives and apply the correct type
             and mark as required if the element contains a value.
             @method buildPrimitive
             @param {Object} tree Schema which represents the node
             @param {Node} node The JSON node being inspected
             @return void
             */
            AST.prototype.buildPrimitive = function(tree, node) {
                tree.type = utils.getType(node);
                if (tree.type === 'string') {
                    tree.minLength = (node.length > 0) ? 1 : 0;
                }

                if (node !== null && typeof node !== 'undefined') {
                    tree.required = true;
                }
            };

            /**
             Inspect object properties and apply the correct
             type and mark as required if the element has set
             properties.
             @method buildObject
             @param {Object} tree Schema which represents the node
             @param {Node} node The JSON node being inspected
             */
            AST.prototype.buildObjectTree = function(tree, node) {
                tree.type = tree.type || 'object';
                tree.children = tree.children || {};
                for (var i in node) {
                    if (utils.isObject(node[i])) {
                        tree.children[i] = {};
                        this.buildObjectTree(tree.children[i], node[i]);
                        continue;
                    } else if (utils.isArray(node[i])) {
                        tree.children[i] = {};
                        this.buildArrayTree(tree.children[i], node[i]);
                    } else {
                        tree.children[i] = {};
                        this.buildPrimitive(tree.children[i], node[i]);
                    }
                }
            };

            /**
             Inspect array elements apply the correct
             type and mark as required if the element has
             set properties.
             @method buildObject
             @param {Object} tree Schema which represents the node
             @param {Node} node The JSON node being inspected
             */
            AST.prototype.buildArrayTree = function(tree, node) {
                tree.type = 'array';
                tree.children = {};
                var first = node[0];
                if (utils.isObject(first)) {
                    var similar = this.isAllSimilarObjects(node);
                    if (this.isAllSimilarObjects(node)) {
                        tree.uniqueItems = true;
                        tree.minItems = 1;

                        return this.buildObjectTree(tree, similar.selected);
                    }
                }

                for (var i=0; i<node.length; i++) {
                    if (utils.isObject(node[i])) {
                        tree.children[i] = {};
                        tree.children[i].type = 'object';
                        var keys = Object.keys(node[i]);
                        if (keys.length > 0) {
                            tree.children[i].required = true;
                        }
                        this.buildObjectTree(tree.children[i], node[i]);
                    } else if (utils.isArray(node[i])) {
                        tree.children[i] = {};
                        tree.children[i].type = 'array';
                        tree.children[i].uniqueItems = true;
                        if (node[i].length > 0) {
                            tree.children[i].required = true;
                        }
                        tree.buildArrayTree(tree.children[i], node[i]);
                    } else {
                        if (tree.type === 'object') {
                            tree.children[i] = {};
                            this.buildPrimitive(tree.children[i], node[i]);
                        }
                    }
                }
            };

            /**
             Initiates generating the AST from the
             given JSON document.
             @param {Object} json JSON object
             @return void
             */
            AST.prototype.build = function(json) {
                if (json instanceof Array) {
                    this.buildArrayTree(this.tree, json);
                } else {
                    this.buildObjectTree(this.tree, json);
                }
            };

            var Compiler = function() {
                if (!this instanceof Compiler) {
                    return new Compiler();
                }

                this.schema = {};
            };

            /**
             Generates a JSON schema based on the provided AST tree.
             @method generate
             @param {Object} tree AST
             @param {Object} schema The schema object
             @param {Object} parent Schema node parent object
             @return void
             */
            Compiler.prototype.generate = function(tree, schema, parent) {
                for (var i in tree.children) {
                    var child = tree.children[i];
                    if (child.type === 'object') {
                        if (utils.isArray(parent.required)) {
                            parent.required.push(i);
                        }
                        schema[i] = {
                            type: 'object'
                            ,properties: {}
                            ,required: []
                        };
                        this.generate(child, schema[i].properties, schema[i]);
                    } else if (child.type === 'array') {
                        if (utils.isArray(parent.required)) {
                            parent.required.push(i);
                        }
                        schema[i] = {
                            type: 'array'
                            ,uniqueItems: child.uniqueItems
                            ,minItems: child.minItems
                            ,items: {
                                required:[]
                                ,properties: {}
                            }
                        };
                        this.generate(child, schema[i].items.properties, schema[i]);
                    } else {
                        schema[i] = {};
                        if (child.type) {
                            schema[i].type = child.type;
                        }

                        if (child.minLength) {
                            schema[i].minLength = child.minLength;
                        }

                        if (child.required) {
                            if (parent.items && utils.isArray(parent.items.required)) {
                                parent.items.required.push(i);
                            } else {
                                parent.required.push(i);
                            }
                        }
                    }
                }
            };

            /**
             Initates compiling the given AST into a
             JSON schema.
             @method compile
             @param {Object} tree AST object
             @return void
             */
            Compiler.prototype.compile = function(tree) {
                if (tree.type === 'object') {
                    this.schema = {
                        '$schema': 'http://json-schema.org/draft-04/schema#'
                        ,description: ''
                        ,type: 'object'
                        ,properties: {}
                        ,required: []
                    };
                    this.generate(tree, this.schema.properties, this.schema);
                } else {
                    this.schema = {
                        type: 'array'
                        ,'$schema': 'http://json-schema.org/draft-04/schema#'
                        ,'description': ''
                        ,minItems: 1
                        ,uniqueItems: true
                        ,items: {
                            type: 'object'
                            ,required: []
                            ,properties: {}
                        }
                    };

                    this.generate(tree, this.schema.items.properties, this.schema.items);
                }
            };


            return {generate:generate};
        }]);

})(window, window.angular);
