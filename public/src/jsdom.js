(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.JSDOM = {}));
}(this, (function (exports) {
    var NODE_TYPE_ELEM = 1;
    var NODE_TYPE_ATTR = 2;
    var NODE_TYPE_TEXT = 3;
    var NODE_TYPE_COMMENT = 8;
    var NODE_TYPE_DOCUMENT = 9;

    var DOM_STATE_COMPLETE = 'complete';
    var DOM_STATE_INTERACTIVE = 'interactive';

    var JSFOR_ATTR_NAME = 'js:for';
    var JSFOR_VALUE_REGEX = /(\w+)\s*in\s*(\w+)/;
    
    var STRING_EMPTY = "";
    var REGEX_ATTR_BINDER = /^js:(\w+)$/;
    var REGEX_TEXT_BINDER = /{:\s*([\w.()]+)\s*:}/g;
    var REGEX_PRIVATE_PROPERTY_NAMES = /^_(\d{10})/;

    var scopes = [];

    String.prototype.FNV32A = function(seed = 0x811c9dc5) {
        var l, hval = seed;
        for (var i = 0, l = this.length; i < l; i++) {
            hval ^= this.charCodeAt(i);
            hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
        };

        return hval >>> 0;
    };

    function _toPrivatePropertyHash(str) {
        var hash = str.FNV32A();
        return '_' + (hash + (hash + str).FNV32A());
    }

    function _deepCopySlowJSON(obj)
    {
        return JSON.parse(JSON.stringify(obj));
    }

    function _getTextContentWithoutDescendants(
                element)
    {
        var texts = [];

        var child = element.firstChild;
        while(child) {
            if(NODE_TYPE_TEXT === child.nodeType)
                texts.push(child.data);
                   
            child = child.nextSibling;
        };

        return texts.join(STRING_EMPTY);
    }

    function _traverseTreeShallow(
                root,
                onElement,
                gate,
                childrenPropertyName='children')
    {
        var count = root[childrenPropertyName].length;
        for (var i = 0; i < count; i++) {
            var child = root[childrenPropertyName][i];
            if(typeof gate === 'function' && !gate(child))
                continue;
            
            if(typeof onElement === 'function')
                onElement.call(null, child);
        };	
    }

    function _traverseTreeDeep(
                root, 
                onElement,  
                gate,
                childrenPropertyName='children')
    {
        var count = root[childrenPropertyName].length;
        for (var i = 0; i < count; i++) {
            var child = root[childrenPropertyName][i];
            if(typeof gate === 'function' && !gate(child))
                continue;
            
            if(typeof onElement === 'function')
                onElement.call(null, child);

            if(child[childrenPropertyName].length > 0)
                _traverseTreeDeep(
                    child, onElement, childrenPropertyName, gate);
        };
    }

    function _buildVirtualDOMFromContainer(
                container, 
                virtual)
    {
        var count = container.childElementCount;

        for (var i = 0; i < count; i++) {
            var child = container.children[i];
            if(!(NODE_TYPE_ELEM == child.nodeType))
                continue;
            
            var element = {
                tag: child.nodeName.toLowerCase(),
                text: _getTextContentWithoutDescendants(child),
                parent: virtual,
                attributes: child.attributes,
                properties: [], 
                children: [],
            };

            virtual.children.push(element);
            if(child.childElementCount > 0)
                _buildVirtualDOMFromContainer(child, element);
        };
    }

    function Section(
                selector) 
    {	
        this.__container = selector ? document.querySelector(selector) : void 0;
        this.__virtual = selector ? {
            text: _getTextContentWithoutDescendants(this.__container),
            tag: this.__container.nodeName.toLowerCase(),
            parent: this.__container.parentElement,
            attributes: this.__container.attributes,
            properties: [],
            children: []
        } : void 0;

        this.__compiled = {};

        var constructed = this.__container && this.__virtual;
        if(constructed) {
            _buildVirtualDOMFromContainer(this.__container, this.__virtual);
            scopes.push(this);
        }
    }

    function _handlePotentialArrayMutation(
                section,
                original,
                potential)
    {

    }

    Section.prototype.define = function(
                key, 
                value) 
    {
        var private = _toPrivatePropertyHash(key);
        this[private] = value;

        var self = this;
        Object.defineProperty(this, key, {
            enumerable: true,
            configurable: false,
            get: function() {
                if(Array.isArray(self[private])) {
                    var original = _deepCopySlowJSON(self[private]);
                    setTimeout(function(org) {
                        _handlePotentialArrayMutation(self, org, self[private]);
                    }, 100, original);
                }

                if(typeof self[private] === 'object') {
                    var original = _deepCopySlowJSON(self[private]);
                    setTimeout(function(org) {
                        //_handlePotentialObjectMutation(self, org, self[private]);
                    }, 100, original);
                }

                return self[private];  
            },
            set: function(v) {
                _handleDirectValueMutation(self, self[private], v);
                self[private] = v;  
            }
        });

        return this;
    };

    function createHTMLTemplateFrom(
                node)
    {
        var tag = node.tag;
        var text = node.text;
        var children  = node.children;
        var attributes = node.attributes;
        

    }

    function _renderSingleNode(
                node)
    {
        if(node.tag == 'br')
            return "<br/>";

        var str = `<${node.tag}>`;
        str += `${node.text === undefined ? STRING_EMPTY : node.text}`
        
        if(node.children.length > 0) {
            for (let i = 0; i < node.children.length; i++)
                str += _renderSingleNode(node.children[i], container);
        }

        str += `</${node.tag}>`

        return str;
    }

    function _render(
                section,
                diff,
                reRender=false)
    {
        if(reRender)
            section.__container.innerHTML = "";
        
        section.__container.insertAdjacentHTML( 'beforeend',  _renderSingleNode(section.__compiled));
    }

    function _deepCopyVirtualNode(node)
    {
        var copy = {
            tag: node.tag,
            text: node.text,
            parent: node.parent,
            attributes: node.attributes,
            properties: _deepCopySlowJSON(node.properties), 
            children: []
        };

        _traverseTreeShallow(node, function(el) {
            var deep = _deepCopyVirtualNode(el);
            deep.parent = copy;

            copy.children.push(deep);
        });

        return copy;
    }

    function _shallowCopyVirtualNode(node, includeChildren = true)
    {
        return {
            tag: node.tag,
            text: node.text,
            parent: node.parent,
            attributes: node.attributes,
            properties: _deepCopySlowJSON(node.properties), 
            children: includeChildren ? node.children : []
        };
    }
    
    function _resolveObjectAccessChain(
                properties,
                chain)
    {
        var base = void 0;
        
        var isArrayPreceding = chain[0].includes('[');
        if(isArrayPreceding) {
            var accessor = chain[0].substr(0, chain[0].indexOf('['));
            var arrayAccessChain = chain[0].substr(chain[0].indexOf('['));

            base = _resolveArrayAccessChain(properties, section, accessor, arrayAccessChain);
        } 
        else
            base = properties[chain[0]];
        
        var next = null;
        for (var i = 1; i < chain.length; i++) {

            var isAccessingArray = chain[i].includes('[');
            if(isAccessingArray) {
                var accessor = chain[i].substr(0, chain[i].indexOf('['));
                var arrayAccessChain = chain[i].substr(chain[i].indexOf('['));
                
                base = _resolveArrayAccessChain(base, properties, accessor, arrayAccessChain);
                continue;
            }

            var isFunctionCallMatch = /(\w+)\(.*?\)$/.exec(chain[i]);
            if(isFunctionCallMatch)
                next = base[isFunctionCallMatch[1]]()
            else
                next = base[chain[i]];

            base = next;
        };
        
        return base;
    }

    function _resolveArrayAccessChain(
                properties,
                section,
                accessor,
                chain)
    {
        var storage = properties[accessor];
        var sequential = chain.split('[').filter(function(v) { return v !== STRING_EMPTY });

        for (var i = 0; i < sequential.length; i++) {
            var indexer = sequential[i];
            var isSubIndexer = !indexer.includes(']');
            
            if(isSubIndexer) {
                var index = chain.substr(chain.indexOf('[') + 1);
                var substr = index.substr(index.indexOf('[') + 1);
                
                return storage[_resolveArrayAccessChain(section, properties, indexer, substr)];
            }

            indexer = indexer.substr(0, indexer.indexOf(']') || indexer.length);
            var isNumber = !isNaN(indexer.charAt(0));
            if(!isNumber) {
                indexer = indexer.replace(/['"]/g, '');
                storage = storage[indexer];
            } else {
                storage = storage[parseInt(indexer)];
            }
        };

        return storage;
    }

    function _resolveElementTextBindings(
                section,
                element)
    {
        if(!element.text || element.text == STRING_EMPTY)
            return;
        
        var match;
        while((match = /{:\s*([\w.()\[\]\"\']+)\s*:}/g.exec(element.text)) != null) {
            var accessor = match[1];

            var objectAccessChain = [];
            var isObjectAccessingChain = accessor.includes('.');
            if(isObjectAccessingChain)
                objectAccessChain = accessor.split('.');

            var arrayAccessChain = [];
            var isArrayAccessor = accessor.includes('[');
            if(isArrayAccessor) {
                arrayAccessChain = accessor.substr(accessor.indexOf('['));
                accessor = accessor.substr(0, accessor.indexOf('['));
            }

            var isDirectPropertyBinding = isObjectAccessingChain ? section.hasOwnProperty(objectAccessChain[0]) : 
                                                                   section.hasOwnProperty(accessor);

            if(isObjectAccessingChain && isArrayAccessor) {
                var isArrayPreceding = objectAccessChain[0].includes('[');
                if(isArrayPreceding)
                    isDirectPropertyBinding = true;
            }

            if(isDirectPropertyBinding) {
                var property = _toPrivatePropertyHash(isObjectAccessingChain ? objectAccessChain[0] : accessor);
                if(isObjectAccessingChain) {
                    element.text = element.text.replace(match[0], 
                        _resolveObjectAccessChain(section, objectAccessChain));
                    
                    continue;
                }

                if(isArrayAccessor && !isObjectAccessingChain) {
                    element.text = element.text.replace(match[0], 
                        _resolveArrayAccessChain(section, section, accessor, arrayAccessChain));
                    continue;
                }

                element.text = element.text.replace(match[0], section[property]);
                continue;
            }

            if(!element.properties || element.properties.length <= 0) {
                return;
            }

            var elementPseudonym = void 0;
            if(isObjectAccessingChain)
                elementPseudonym = objectAccessChain[0];
            else
                elementPseudonym = accessor;

            for (var i = 0; i < element.properties.length; i++) {
                var property = element.properties[i];
                if(property.hasOwnProperty(elementPseudonym))
                {
                    if(isObjectAccessingChain) {
                        element.text = element.text.replace(match[0], 
                            _resolveObjectAccessChain(property, objectAccessChain));
                        break;
                    }

                    if(isArrayAccessor && !isObjectAccessingChain) {
                        element.text = element.text.replace(match[0], 
                            _resolveArrayAccessChain(property, section, elementPseudonym, arrayAccessChain));
                        break;
                    }
                }
            };
        };
    }

    function _compile(
        section,
        subtree)
    {
        var compiled = _shallowCopyVirtualNode(subtree, false);
        
        var deep = _deepCopyVirtualNode(subtree);
        _traverseTreeDeep(deep, (element) => {

            var tag = element.tag;
            var attributes = element.attributes;

            var hasAttributes = attributes && attributes.length > 0;
            if(hasAttributes)
            {
                for (var i = 0; i < attributes.length; i++) {
                    var attr = attributes[i];
                    
                    var name = attr.nodeName || attr.name || attr.localName;
                    var value = attr.nodeValue || attr.value;

                    var isConventionMatched = REGEX_ATTR_BINDER.test(name);
                    if(!isConventionMatched)
                        continue;
                    
                    switch(name)
                    {
                        case JSFOR_ATTR_NAME: {
                            var match = /(\w+)\s*in\s*(\w+)/.exec(value);
                            if(!match)
                                break;

                            var elementPseudonym = match[1];
                            var elementStoragePropertyName = match[2];
                            
                            var property = section[_toPrivatePropertyHash(elementStoragePropertyName)];
                            
                            if(Array.isArray(property) && property.length > 0) 
                            {
                                for (var i = 1; i < property.length; i++) {
                                    var prefab = _deepCopyVirtualNode(element);
                                    
                                    var l = prefab.properties.push({ });
                                    prefab.properties[l - 1][elementPseudonym] = property[i];

                                    _traverseTreeDeep(prefab, function(el) { 
                                        var len = el.properties.push({ });
                                        el.properties[len - 1][elementPseudonym] = property[i]; 
                                    });
                                    
                                    element.parent.children.push(prefab);
                                };
                                
                                var l = element.properties.push({ });
                                element.properties[l - 1][elementPseudonym] = property[0];

                                _traverseTreeDeep(element, function(el) {
                                    var len = el.properties.push({ });
                                    el.properties[len - 1][elementPseudonym] = property[0];
                                });
                            }
                        } break;
                    };
                };
            }

            var isDirectChildren = element.parent == deep;
            if(isDirectChildren)
                compiled.children.push(element);
        });

        console.log("COMPILATION FINISHED");
        console.log("--------------------------------");
        console.log(compiled);

        _resolveElementTextBindings(section, compiled);
        _traverseTreeDeep(compiled, function(element) {
            _resolveElementTextBindings(section, element);
        });

        return compiled;
    }

    document.addEventListener('readystatechange', function() {
        if(DOM_STATE_COMPLETE === document.readyState)
            return;

        var section = scopes[0];

        var z0  = performance.now();
        section.__compiled = _compile(section, section.__virtual);
        var z1 = performance.now();

        console.log("COMPILING TOOK " + (z1 - z0) + "ms ");
        _render(section, null, true);
    });

    exports.Section = Section;
})));
