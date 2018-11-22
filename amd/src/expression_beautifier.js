// define(['jquery', 'core/str', 'core/ajax'], function($, str, ajax) {
define('local_freeform/expression_beautifier', ["jquery"], function($) {

    // constant priority definition
    prioMod  = 0;    // modifier (square brackets)
    prioBr   = 1;    // brackets
    prioComp = 2;    // comparator (eg =, >=, etc)
    prioAdd  = 3;    // addition and subtraction
    prioMul  = 4;    // multiplication and division (not fractions)
    prioFrac = 5;    // fraction
    prioFn   = 6;    // function
    prioIMul = 7;    // implicit multiply as in 2A (but not 2 A which would be prioMul)
    prioPow  = 8;    // power
    prioSubs = 9;    // subscript
    prioDec  = 9;    // decoration (as in bold, colour, range, ...)
    prioLine = 9;    // underline, overline, etc
    prioQ    = 10;   // question

    return {
        // constant substitution definitions for full text standardisation
        fullTextSubstitutions: {
            '<p>'  : '',
            '</p>' : '<br>',
        },

        // constant substitution definitions for expression text standardisation
        expressionSubstitutions: {
            '\u2070'   : '^0 ',
            '\xB9'     : '^1 ',
            '\xB2'     : '^2 ',
            '\xB3'     : '^3 ',
            '\u2074'   : '^4 ',
            '\u2075'   : '^5 ',
            '\u2076'   : '^6 ',
            '\u2077'   : '^7 ',
            '\u2078'   : '^8 ',
            '\u2079'   : '^9 ',
            '\u2071'   : '^i ',
            '\x80'     : '^0',   // alternative comma
            '\x82'     : ',',    // alternative comma
            '\x83'     : ' f ',  // f as in f(x)
            '\x85'     : '...',  // ...
            '\xF7'     : '/',    // division symbols as in a / b
            '\\+/-'    : '+-',   // +/- as equivalent of +-
            '-/\\+'    : '-+',   // -/+ as equivalent of -+
            '\\binfinity\\b'                : 'infin',          // infinity as equivalent of infin
            'root2'                         : 'sqrt',           // square root
            'root3'                         : 'rtthree',        // cube root
            'root4'                         : 'rtfour',         // fourth root
            '([A-Za-z])([0-9]+)'            : '$1_$2',          // subscript as in A0 => A_0
            '^([\\.,])([0-9])'              : '0$1$2',          // leading decimal such as ".3 * X"
            '([^\\.0-9])([\\.,])([0-9])'    : '$1 0$2$3',       // decimal without preceding digit "X * .3"
            '([0-9])([\\.,])$'              : '$1',             // trailing decimal such as "X * 3."
            '([0-9])([\\.,])([^\\.0-9])'    : '$1 $3',          // decimal without following digit "3. * X"
            '\\?([0-9]+)\\?'                : '[question]($1)', // rewrites ?123? as [question]123
            '<strong>'                      : '[bold]',         // implicit support for html bold
            '</strong>'                     : '',               // implicit support for html bold
            '<em>'                          : '[italic]',       // implicit support for italic
            '</em>'                         : '',               // implicit support for italic
            '\\b((?:arc)?(?:sin|cos|tan))\\^((?:-?\\d+)(?:[,.]\\d+)?)': '[power $2]$1', // rewrite sin^2(theta) => [power 2]sin(theta)
        },

        // constant operator trait definitions
        opTraits: {
            // modifier delimiters
            '['         : { type:'[',      prio:prioMod,  txt:'[',         sym:'['          },
            ']'         : { type:']',      prio:prioMod,  txt:']',         sym:']'          },

            // sub-clause delimiters
            '('         : { type:'(',      prio:prioBr,   txt:'(',         sym:'('          },
            ')'         : { type:')',      prio:prioBr,   txt:')',         sym:')'          },

            // mathematical operators
            '-'         : { type:'ubin',   prio:prioAdd,  txt:'-',         sym:'&minus;'    },
            '+'         : { type:'ubin',   prio:prioAdd,  txt:'+',         sym:'+'          },
            '^'         : { type:'bin',    prio:prioPow,  txt:'^',         sym:'^'          }, // power or superscripy
            '*'         : { type:'bin',    prio:prioMul,  txt:'*',         sym:'&times;'    },
            '/'         : { type:'bin',    prio:prioFrac, txt:'/',         sym:'&frasl;'    },
            './'        : { type:'bin',    prio:prioMul,  txt:'./',        sym:'&divide;'   },
//            '^^'        : { type:'bin',    prio:prioSubs, txt:'^^',        sym:''           }, // subscript

            // compare operators
            '~'         : { type:'ubin',   prio:prioComp, txt:'~',         sym:'&sim;'      },
            '='         : { type:'bin',    prio:prioComp, txt:'=',         sym:'='          },
            '<'         : { type:'bin',    prio:prioComp, txt:'<',         sym:'&lt;'       },
            '>'         : { type:'bin',    prio:prioComp, txt:'>',         sym:'&gt;'       },
            '<='        : { type:'bin',    prio:prioComp, txt:'<=',        sym:'&leqslant;' }, // or &le;
            '>='        : { type:'bin',    prio:prioComp, txt:'>=',        sym:'&geqslant;' }, // or &ge;
            '=='        : { type:'bin',    prio:prioComp, txt:'==',        sym:'&equiv;'    },
            '~='        : { type:'bin',    prio:prioComp, txt:'~=',        sym:'&cong;'     },
            '=~'        : { type:'bin',    prio:prioComp, txt:'=~',        sym:'&prop;'     },
            '/='        : { type:'bin',    prio:prioComp, txt:'/=',        sym:'&ne;'       },
            '!='        : { type:'bin',    prio:prioComp, txt:'!=',        sym:'&ne;'       },
            '<>'        : { type:'bin',    prio:prioComp, txt:'<>',        sym:'&ne;'       },
            '+-'        : { type:'bin',    prio:prioComp, txt:'+-',        sym:'&#xB1;'     },
            '-+'        : { type:'bin',    prio:prioComp, txt:'-+',        sym:'&#x2213;'   },

            // decoration operators
            '_'         : { type:'bin',    prio:prioLine, txt:'_',         sym:'_'          }, // subscript operator
            '..'        : { type:'bin',    prio:prioComp, txt:'..',        sym:'..'         }, // range operator

            // decorating link operators
            '__'        : { type:'link',   prio:prioLine, txt:'__',        sym:'&#x35F;', symJoin:'&#x35F;', sym0:'&#x0332;' }, // underline
            '_>'        : { type:'link',   prio:prioLine, txt:'_>',        sym:'&#x362;'                                     }, // arrowed underline,
            '^_'        : { type:'link',   prio:prioLine, txt:'^_',        sym:'&#x35E;', symJoin:'&#x35E;', sym0:'&#x0305;' }, // overline
            '^~'        : { type:'link',   prio:prioLine, txt:'^~',        sym:'&#x360;'                                     }, // wavy overline
            '^^'        : { type:'link',   prio:prioLine, txt:'^^',        sym:'&#x361;'                                     }, // archer overline
        },

        // constant function trait definitions
        fnTraits: {
            'sum'       : { type:'macro',  prio:prioFn,   txt:'sum',       sym:'&sum;'      },
            'product'   : { type:'macro',  prio:prioFn,   txt:'product',   sym:'&prod;'     },
            'integral'  : { type:'macro',  prio:prioFn,   txt:'integral',  sym:'&int;'      },
            "f"         : { type:'fn',     prio:prioFn,   txt:'f',         sym:'&fnof;'     }, // f of (as in function if)
            "sin"       : { type:'fn',     prio:prioFn,   txt:'sin',       sym:'sin'        },
            "cos"       : { type:'fn',     prio:prioFn,   txt:'cos',       sym:'cos'        },
            "tan"       : { type:'fn',     prio:prioFn,   txt:'tan',       sym:'tan'        },
            "arcsin"    : { type:'fn',     prio:prioFn,   txt:'arcsin',    sym:'arcsin'     },
            "arccos"    : { type:'fn',     prio:prioFn,   txt:'arccos',    sym:'arccos'     },
            "arctan"    : { type:'fn',     prio:prioFn,   txt:'arctan',    sym:'arctan'     },
            "sqrt"      : { type:'root',   prio:prioFn,   txt:'sqrt',      sym:'&radic;'    },
            "rtthree"   : { type:'root',   prio:prioFn,   txt:'root3',     sym:'&#x221B;'   },
            "rtfour"    : { type:'root',   prio:prioFn,   txt:'root4',     sym:'&#x221C;'   },
        },

        // constant keyword definitions for supported html keywords
        keyWords: [
            'alpha',    'Alpha',
            'beta',     'Beta',
            'gamma',    'Gamma',
            'delta',    'Delta',
            'epsilon',  'Epsilon',
            'zeta',     'Zeta',
            'eta',      'Eta',
            'theta',    'Theta',
            'iota',     'Iota',
            'kappa',    'Kappa',
            'lambda',   'Lambda',
            'mu',       'Mu',
            'nu',       'Nu',
            'xi',       'Xi',
            'omicron',  'Omicron',
            'pi',       'Pi',
            'rho',      'Rho',
            'sigma',    'Sigma',
            'tau',      'Tau',
            'upsilon',  'Upsilon',
            'phi',      'Phi',
            'chi',      'Chi',
            'psi',      'Psi',
            'omega',    'Omega',
            'infin'
        ],

        // configuration variables
        questionContextName: '',
        instanceId: '',

        // work containers (stacks) for tree construction
        opStack     : [],
        valStack    : [],

        // private utility method
        cleanFullText: function (txt) {
            let result = txt;
            for (let pat in this.fullTextSubstitutions) {
                result = result.replace(new RegExp(pat, 'g'), this.fullTextSubstitutions[pat]);
            }
            return result;
        },

        // public utility method
        cleanExpressionText: function (txt) {
            let result = txt;
            for (let pat in this.expressionSubstitutions) {
                result = result.replace(new RegExp(pat, 'g'), this.expressionSubstitutions[pat]);
            }
            return result;
        },

        // private utility method
        pushVal: function(newVal) {
            this.valStack.push(newVal);
        },

        // private utility method
        popVal: function() {
            if (!(this.valStack.length)) {
                console.error('Trying to pop value from empty valStack');
            }
            return (this.valStack.length) ? this.valStack.pop() : {type: 'err', txt: '...'};
        },

        // private utility method
        opStackPeek: function () {
            return (this.opStack.length > 0) ? this.opStack[this.opStack.length - 1] : {
                type: null,
                prio: -1,
                txt: null
            };
        },

        // private utility method
        makeTreeNodes: function (prio) {
            if (this.opStack.length === 0) {
                return;
            }
            // allow decoration modifiers to stack from right to left instead of left to right
            if (prio === prioDec && this.opStackPeek().type === 'modifier') {
                return;
            }
            while (this.opStack.length > 0) {
                let peek = this.opStackPeek();
                if (prio <= prioBr && prio >= 0) {
                    if (peek.prio !== prio && peek.prio <= prioBr) {
                        break;
                    }
                } else {
                    if (peek.prio < prio) {
                        break;
                    }
                }

                // prime the new entry that we intend to push back to the val stack
                let op           = this.opStack.pop();
                let topVal       = this.popVal();
                let newNode      = JSON.parse(JSON.stringify(op));
                newNode.children = [ topVal ];

                // add a little type-specific configuration
                switch (op.type) {
                    case 'link':
                        for (let i = 1; i < op.childCount; ++i) {
                            let nextVal = this.popVal();
                            newNode.children.push(nextVal);
                        }
                        newNode.children = newNode.children.reverse();
                        break;

                    case 'fn':
                    case 'root':
                    case 'macro':
                    case 'modifier':
                        newNode.txt = op.sym;
                        break;

                    case 'unary':
                        newNode.type = 'unary' + op.txt;
                        break;

                    case 'binary':
                        let secondVal = this.popVal();
                        newNode.type     = op.txt;
                        newNode.children = [ secondVal, topVal ];
                        break;

                    default:
                        console.error("makeTreeNodes: Failed to identify operator type:", op);
                        continue;
                }

                // push the new entry to the val stack
                this.pushVal(newNode);

                // avoid accidentally matching more than one '(' to a single ')'
                if (prio <= prioBr && op.prio === prio) {
                    return;
                }
            }
        },

        // private utility method
        pushOp: function (newOp) {
            // if this isn't a unary operator then evaluate out any lower prio preceding items
            if (newOp.type === 'binary') {
                this.makeTreeNodes(newOp.prio);
            }
            this.opStack.push(newOp);
        },

        // private utility method
        parseExpression: function (txt) {
            const regex = /(\d+[.,]\d+|\d+)|([A-Za-z][a-z]*)|(['"]+)|(\^~|\^\^|\^_|__|_>|<=|>=|==|<>|\/=|!=|~=|=~|\.\/|\.\.|\+-|-\+|[\-*/^+=<>~_()\[\]])|(\s+)|(\S)/g;
            const matchTypes = [
                'num', 'id', 'prime', 'op', 'space', 'err',
            ];

            this.parseErrors = 0;
            this.maxIdLength = 0;
            let result = [];

            // fetch each regex match from the input string until no more matches remain
            let prevTypeName = '';
            let a;
            while ((a = regex.exec(txt)) !== null) {
                const matchedTxt = a[0];
                let typeName = '';

                // determine which clause from the regex was matched
                for (let i = 0; i < matchTypes.length; ++i) {
                    if (a[i + 1]) {
                        // we have found the matching regex so record its type and jump out
                        typeName = matchTypes[i];
                        break;
                    }
                }

                // if we matched an operator then look it up, otherwise construct a record dynamically
                let token = {type: typeName, txt: matchedTxt};
                if (typeName === 'op') {
                    token = (this.opTraits[matchedTxt] ? this.opTraits[matchedTxt] : {type: 'err', txt: matchedTxt});
                }

                // if we matched an identifier then check whether it's a function
                if (typeName === 'id' && this.fnTraits[matchedTxt]) {
                    typeName = 'op';
                    let fn = this.fnTraits[matchedTxt];
                    token = {type: fn.type, prio: fn.prio, txt: fn.txt, sym: fn.sym, rangeFrom: '', rangeTo: ''};
                }

                // if we matched an identifier then update the maxIdLength value
                if (typeName === 'id') {
                    let len = this.keyWords.find(t => matchedTxt === t) ? 1 : matchedTxt.length;
                    this.maxIdLength = Math.max(this.maxIdLength, len);
                }

                // if this is a subscript then force maxIdLength to at least a value of 2 to avoid gluing of A0B elements
                if (a[0] === '_') {
                    this.maxIdLength = Math.max(this.maxIdLength, 2);
                }

                // increment error count as required
                if (token.type === 'err') {
                    console.log('Parse Error at: ', a, 'after', result);
                    ++this.parseErrors;
                }

                // push the token for the matched text
                result.push(token);

                // store away the type name for comparison on following iteration
                prevTypeName = (matchedTxt === ')') ? ')' : typeName;
            }
            return result;
        },

        // private utility method
        dumpTokens: function (tokens) {
            let result = '<div class="freeform-root freeform-dump">';
            for (let token of tokens) {
                result += (token.type === 'err') ? '<span class="freeform-error">' : '';
                result += token.txt;
                result += (token.type === 'err') ? '</span>' : '';
            }
            result += '</div>';
            return result;
        },

        // private utility method
        constructTreeBegin: function (token) {
            // we're expecting a unary operator or a value
            switch (token.type) {
                case 'space':
                    break;

                case 'num':
                case 'id':
                    this.pushVal(token);
                    this.state   = 'end';
                    this.isGlued = true;
                    break;

                case '[':
                    this.constructTreeModifierBegin();
                    break;

                case '(':
                case 'unary':
                case 'ubin':
                    this.pushOp({type: 'unary', prio: token.prio, txt: token.txt});
                    break;

                case 'fn':
                case 'root':
                case 'macro':
                    let clonedToken = JSON.parse(JSON.stringify(token));
                    this.pushOp(clonedToken);
                    break;

                case 'link':
                    let linkToken = JSON.parse(JSON.stringify(token));
                    linkToken.childCount = 1;
                    this.pushOp(linkToken);
                    break;

                case 'bin':
                    this.pushVal({type: 'err', txt: '...'});
                    this.constructTreeEnd(token);
                    break;

                case ')':
                    // do we have the f() case ?
                    if (this.opStackPeek().txt === '(') {
                        // evaluate out anything in the expression stack down to the next '('
                        this.pushVal({type: 'id', txt: ''});
                        this.makeTreeNodes(0);
                        this.state = 'end';
                        this.isGlued = false;
                        break;
                    }
                // else drop through to the default case

                default:
                    this.pushVal({type: 'err', txt: '...'});
                    this.state = 'end';
                    this.constructTreeEnd(token);
                    break;
            }
        },

        // private utility method
        constructTreeEnd: function (token) {
            switch (token.type) {
                case ')':
                    // evaluate out anything in the expression stack down to the next '('
                    this.makeTreeNodes(prioBr);
                    break;

                case 'ubin':
                case 'bin':
                    this.pushOp({type: 'binary', prio: token.prio, txt: token.txt});
                    this.state = 'begin';
                    break;

                case 'space':
                    this.isGlued = false;
                    break;

                case 'prime':
                    this.makeTreeNodes(prioLine);
                    this.valStack[this.valStack.length - 1].prime = token.txt;
                    break;

                case 'id':
                case '[':
                case '(':
                case 'unary':
                case 'num':
                case 'fn':
                case 'root':
                case 'macro':
                case 'link':
                    // if we have an id and the current active operator is a link then tell the link to consume us
                    if (this.isGlued && token.type === 'id') {
                        let topOp = this.opStackPeek();
                        if (topOp.type === 'link') {
                            ++topOp.childCount;
                            this.state = 'begin';
                            this.constructTreeBegin(token);
                            break;
                        }
                    }
                    // add an implicit multiply to glue consecutive elements together
                    let prio = this.isGlued ? prioIMul : prioMul;
                    this.pushOp({type: 'binary', prio: prio, txt: ''});
                    this.state = 'begin';
                    this.constructTreeBegin(token);
                    break;

                default:
                    console.error("constructTreeEnd: Failed to match token", token);
            }
        },

        // private utility method
        constructTreeModifierBegin: function () {
            this.modifierDepth      = 1;
            this.modifierContent    = '';
            this.modifierChildren   = [ [] ];
            this.modifierType       = '';
            this.modifierHasSpace   = false;
            this.state              = 'modifier';
        },

        // private utility method
        constructTreeModifier: function (token) {
            switch (token.txt) {
                case ']':
                    if (--this.modifierDepth <= 0) {
                        this.constructTreeModifierEnd();
                        return;
                    }
                    break;
                case '..':
                    this.modifierType           = '..';
                    this.modifierChildren[1]    = [];
                    return;
                case '[':
                    ++this.modifierDepth;
                    break;
            }
            // if we have a space then just note its presence for use as required afterwards
            if (token.type === 'space') {
                this.modifierHasSpace = true;
                return;
            }

            // determine whether or not to pad the next section of content text with a space
            let space = (this.modifierContent !== '' && this.modifierHasSpace === true) ? ' ' : '';
            this.modifierHasSpace = false;

            // append whatever we have found to the modifier content
            let idx = this.modifierChildren.length - 1;
            this.modifierChildren[idx].push(token);
            this.modifierContent += space + token.txt;
        },

        // private utility method
        constructTreeModifierEnd: function () {
            this.state = 'begin';
            switch (this.modifierType) {
                case '':
                    if (/^\(.*\)$/.test(this.modifierContent)) {
                        this.modifierType = '()';
                        this.modifierContent = this.modifierContent.replace(/^\((.*)\)$/, '$1');
                    }
                    switch (this.modifierContent) {
                        case 'question':
                            this.pushOp({
                                type: 'modifier',
                                prio: prioQ,
                                txt: '',
                                decType: '?'
                            });
                            break;
                        case 'bold':
                        case 'italic':
                        case 'underline':
                        case '-bold':
                        case '-italic':
                        case '-underline':
                        case 'red':
                        case 'green':
                        case 'blue':
                        case 'grey':
                        case 'black':
                        case 'yellow':
                            this.pushOp({
                                type: 'modifier',
                                prio: prioDec,
                                txt: '',
                                decType: this.modifierType,
                                decData: [this.modifierContent]
                            });
                            break;
                        default:
                            // look for the power modifier
                            let a;
                            if ((a = /^power (.*)/.exec(this.modifierContent)) !== null) {
                                this.pushOp({
                                    type: 'unary',
                                    prio: prioPow,
                                    txt: 'power',
                                    power: a[1]
                                });
                                break;
                            }
                            console.log("Unrecognised modifier: ", this.modifierContent, this);
                            this.pushOp({
                                type: 'modifier',
                                prio: prioDec,
                                txt: '',
                                decType: 'err',
                                decData: [this.modifierContent]
                            });
                    }
                    break;
                case '..':
                    // evaluate out the range to and from expressions
                    let tokensFrom  = this.modifierChildren[0];
                    let tokensTo    = this.modifierChildren[1];
                    let rangeFrom   = this.constructTree(tokensFrom);
                    let rangeTo     = this.constructTree(tokensTo);
                    // if we have stacked modifiers (such as [bold] then pop them and re-apply them to the rangeTo and rangeFrom expressions instead
                    while (this.opStackPeek().type === 'modifier'){
                        let modifierFrom        = this.opStack.pop();
                        let modifierTo          = JSON.parse( JSON.stringify( modifierFrom ) );
                        modifierFrom.children   = [ rangeFrom.children[0] ];
                        modifierTo.children     = [ rangeTo.children[0] ];
                        rangeFrom               = { type: "head", txt: "", children: [modifierFrom] };
                        rangeTo                 = { type: "head", txt: "", children: [modifierTo] };
                    }

                    // push the resulting modifier onto the stack
                    this.pushOp({
                        type: 'modifier',
                        prio: prioDec,
                        txt: '',
                        decType: '..',
                        decData: [rangeFrom, rangeTo]
                    });
                    break;

                default:
                    this.pushOp({
                        type: 'modifier',
                        prio: prioDec,
                        txt: '',
                        decType: 'err',
                        decData: [this.modifierContent]
                    });
            }
        },

        // private utility method
        constructTree: function (tokens) {
            // store away previous context in order to allow recursion
            let oldOpStack  = this.opStack  ? this.opStack  : null;
            let oldValStack = this.valStack ? this.valStack : null;
            let oldState    = this.state    ? this.state    : null;
            let oldIsGlued  = this.isGlued  ? this.isGlued  : null;

            this.opStack    = [];
            this.valStack   = [];
            this.state      = 'begin';        // state may be 'begin' (expecting value) or 'end' (expecting operator)
            this.isGlued    = false;        // true for cases like AB, false for cases like A B
            for (let token of tokens) {
                switch (this.state) {
                    case 'begin':
                        this.constructTreeBegin(token);
                        break;
                    case 'end':
                        this.constructTreeEnd(token);
                        break;
                    case 'modifier':
                        this.constructTreeModifier(token);
                        break;
                }
            }

            // lookout for incomplete parameter set
            if (this.state === "begin" && tokens.length) {
                this.pushVal({type: 'err', txt: '...'});
            }

            // evaluate out anything left on the expression stack
            this.makeTreeNodes(-1);
            let result = this.valStack;

            // restore previous state for recursion management
            this.opStack  = oldOpStack;
            this.valStack = oldValStack;
            this.state    = oldState;
            this.isGlued  = oldIsGlued;

            // return the result
            return {type: 'head', txt: '', children: result};
        },

        // private utility method
        cleanTree: function (node) {
            // if we have any children then iterate over them, recursing
            if (node.children) {
                // cleanup children
                let newChildren = [];
                for (let child of node.children) {
                    let newChild = this.cleanTree(child);
                    // // if this is a '()' sub-clause and our parent is a '/' clause then get rid of us all together
                    // if (child.type==="unary(" && node.type==='/' && child.children.length===1){
                    //     newChild = child.children[0];
                    // }
                    newChildren.push(newChild);
                }
                node.children = newChildren;

                // check for special case of merging implicit multiply lists
                if (node.type === '') {
                    newChildren = [];
                    newChildren = newChildren.concat((node.children[0].type === '') ? node.children[0].children : [node.children[0]]);
                    newChildren = newChildren.concat((node.children[1].type === '') ? node.children[1].children : [node.children[1]]);
                    node.children = newChildren;
                }
            }
            return node;
        },

        // private utility method
        getHeight: function (node) {
            let result = 1;
            if (node.type === '/') {
                return this.getHeight(node.children[0]) + this.getHeight(node.children[1]);
            }
            if (node.type === 'macro') {
                return this.getHeight(node.children[0]) + 1;
            }
            if (node.children && node.children.length) {
                for (let child of node.children) {
                    result = Math.max(result, this.getHeight(child));
                }
            }
            return result;
        },

        // private utility method
        renderTree: function (rootNode, isSubExpression=false) {
            if (isSubExpression === false) {
                // set the default fraction mode, used in rendering fraction children of root node
                this.fractionMode = 'multi-line';

                // write the div wrapper round the expression and recurse into the children
                let html = '';
                html += "<div class='freeform-root'>";
                html += this.render(rootNode);
                html += "</div>";   // mathtext
                return html;
            } else {
                // for sub-expressions use single-line fraction mode and return the rendered root node without the mathtext div wrapper
                this.fractionMode = 'single-line';
                return this.render(rootNode);
            }
        },

        // private utility method
        renderLeftBracket: function(heightInLines){
            let height = heightInLines * 100;
            let html = '';
            // TODO: Potentially add logic that only adds freeform-left-bracket class if the line count > 1
            html += "<div class='freeform-spaced freeform-left-bracket' style='font-size:"+height+"%'>";
            html += "&#x27EE;";
            html += "</div>";
            return html;
        },

        // private utility method
        renderRightBracket: function(heightInLines){
            let height = heightInLines * 100;
            let html = '';
            // TODO: Potentially add logic that only adds freeform-left-bracket class if the line count > 1
            html += "<div class='freeform-spaced freeform-right-bracket' style='font-size:"+height+"%'>";
            html += "&#x27EF;";
            html += "</div>";
            return html;
        },

        // private utility method
        render: function (node, addSubClauseBrackets = true) {
            // constant separator definitions

            // store away mode flags for restoring on return
            let oldFractionMode = this.fractionMode;

            let html = '';
            switch (node.type) {
                case 'head':
                    html += "<div class='freeform-row freefrom-head'>";
                    for (let child of node.children) {
                        html += this.render(child);
                    }
                    html += "</div>";
                    break;

                case '-':
                case '+':
                case '*':
                case './':
                case '~':
                case '=':
                case '<':
                case '>':
                case '<=':
                case '>=':
                case '==':
                case '~=':
                case '=~':
                case '/=':
                case '!=':
                case '<>':
                case '+-':
                case '-+':
                case '..':
                    html += this.render(node.children[0]);
                    html += "<div class='freeform-spaced freefrom-operator'>";
                    html += this.opTraits[node.type].sym;
                    html += "</div>";
                    html += this.render(node.children[1]);
                    break;

                case 'link':
                    // ensure that we only have identifiers and only single character identifiers at that
                    let isValidLink = true;
                    for (let i = 0; i < node.children.length; ++i) {
                        isValidLink = isValidLink && (node.children[i].type === 'id');
                        isValidLink = isValidLink && (node.children[i].txt.length === 1);
                    }

                    // make sure that the number of children that we have is correct
                    isValidLink = isValidLink && ((node.children.length > 1) || !!node.sym0);
                    isValidLink = isValidLink && ((node.children.length < 3) || !!node.symJoin);

                    // if we have an error case then deal with it
                    if (isValidLink === false) {
                        html += "<div class='freeform-row freeform-error'>";
                        html += node.txt;
                        for (let i = 0; i < node.children.length; ++i) {
                            html += node.children[i].txt;
                        }
                        let minChildCount = (!!node.sym0) ? 0 : 1;
                        for (let i = node.children.length; i < minChildCount; ++i) {
//                        for (let i=node.children.length; i< node.minChildCount; ++i){
                            html += "...";
                        }
                        html += "</div>";
                        break;
                    }

                    // output the first child character
                    html += node.children[0].txt;

                    // check whether we're in the special case condition of a single decorated character
                    if (node.children.length === 1) {
                        // output the html single-character modifier code
                        html += node.sym0;
                    } else {
                        // link all but the final element
                        for (let i = 1; i < node.children.length - 1; ++i) {
                            html += node.symJoin;
                            html += node.children[i].txt;
                        }

                        // link the final element
                        html += node.sym;
                        html += node.children[node.children.length - 1].txt;
                    }
                    break;

                case '':
                    html += "<div class='freeform-row freeform-spaced freeform-implicit-multiply'>"; //row
                    html += this.render(node.children[0]);
                    for (let i=1; i < node.children.length; ++i){
                        html += this.render(node.children[i]);
                    }
                    html += "</div>"; // row
                    break;

                case '/':
                    if (this.fractionMode === 'multi-line') {
                        html += "<div class='freeform-spaced freeform-fraction'>";
                        html += "<div class='freeform-row'>";
                        html += this.render(node.children[0], false);
                        html += "</div>";   // row
                        html += "<div class='freeform-row'>";
                        html += this.render(node.children[1], false);
                        html += "</div>";   // row
                        html += "</div>";   // fraction
                    } else {
                        html += this.render(node.children[0]);
                        html += "<div class='freeform-spaced freefrom-operator'>";
                        html += this.opTraits[node.type].sym;
                        html += "</div>";
                        html += this.render(node.children[1]);
                    }
                    break;

                case '^':
                    html += "<div class='freeform-row freeform-spaced freeform-decoration-group'>"; // parent cell

                    // render the element to the left
                    html += "<div class='freeform-decorated'>"; // decorated
                    html += this.render(node.children[0]);
                    html += "</div>";   // decorated

                    // switch to linear fraction display mode
                    this.fractionMode = 'single-line';

                    // render the exponent
                    html += "<div class='freeform-row freeform-superscript'>"; // superscript
                    html += this.render(node.children[1], false);
                    html += "</div>";   // superscript

                    html += "</div>";   // parent cell
                    break;

                case '_':
                    // if we have a prime on the right element then move it up to the parent element
                    let primeSuspect = node.children[1];
                    while (primeSuspect.type === 'modifier') {
                        primeSuspect = primeSuspect.children[0];
                    }
                    if (primeSuspect.prime) {
                        node.prime = primeSuspect.prime;
                        delete primeSuspect.prime;
                    }

                    html += "<div class='freeform-row freeform-spaced freeform-decoration-group'>";   // parent cell

                    // render the element to the left (which should be an identifier)
                    html += "<div class='freeform-decorated'>"; // decorated
                    html += this.render(node.children[0]);
                    html += "</div>";   // decorated

                    // switch to linear fraction display mode
                    this.fractionMode = 'single-line';

                    // render the subscript
                    html += "<div class='freeform-row freeform-subscript'>";   // subscript
                    html += this.render(node.children[1], false);
                    html += "</div>";   // subscript

                    html += "</div>";   // parent cell
                    break;

                case 'unarypower':
                    // for fn nodes delegate rendering to the child
                    if (node.children[0].type === 'fn') {
                        node.children[0].power = node.power;
                        html = this.render(node.children[0]);
                        break;
                    }

                    // this isn't a fn node so behave like a normal ^ operator
                    html += "<div class='freeform-row'>"; // parent cell

                    // render the element to the left
                    html += this.render(node.children[0]);

                    // switch to linear fraction display mode
                    this.fractionMode = 'single-line';

                    // render the exponent
                    html += "<div class='freeform-superscript'>"; // superscript
                    html += node.power;
                    html += "</div>";   // superscript

                    html += "</div>";   // parent cell
                    break;

                case 'unary-':
                case 'unary+':
                    html = this.opTraits[node.txt].sym + this.render(node.children[0]);
                    break;

                case 'unary(':
                    if (addSubClauseBrackets === false) {
                        html += this.render(node.children[0]);
                    } else {
                        let lines = this.getHeight(node);
                        let height = lines * 100;
                        html += this.renderLeftBracket(lines);
                        html += this.render(node.children[0]);
                        html += this.renderRightBracket(lines);
                    }
                    break;

                case 'modifier': // decoration modifier
                    if (node.children.length) {
                        let child = node.children[0];
                        switch (node.decType) {

                            case '()':
                            case '':
                                let applySubClauseBrackets = (addSubClauseBrackets && node.decType !== '()');
                                html += "<div class='freeform-row freeform-dec-" + node.decData[0] + "'>";
                                html += this.render(child, applySubClauseBrackets);
                                html += "</div>";
                                break;

                            case '?':
                                let qid = child.children[0].txt;
                                let prefix = this.questionContextName ? this.questionContextName + '_' : '';
                                html += "<div class='freeform-row freeform-question' for='"+prefix+"ffq_"+this.instanceId+"_"+qid+"'>";
                                if  (qid in this.answers && this.answers[qid]) {
                                    let answerTxt = this.answers[qid];
                                    let answerSubTree = this.buildExpressionTree(answerTxt);
                                    html += this.render(answerSubTree);
                                } else {
                                    html += '?';
                                }
                                html += "</div>";
                                break;

                            case '..':
                                console.log("modifier error: ", node);
                                html += "<div class='freeform-error'>[ ";
                                html += node.decData[0];
                                html += " .. ";
                                html += node.decData[1];
                                html += " ]";
                                html += "</div>";
                                html += this.render(node.children[0]);
                                break;

                            case 'err':
                                console.log("modifier error: ", node);
                                html += "<div class='freeform-row freeform-error'>[";
                                html += node.decData[0];
                                html += "]";
                                html += "</div>";
                                html += this.render(node.children[0]);
                                break;

                            default:
                                console.error('Unrecognised decorator type: ', node.decType, node);
                        }
                    }
                    break;

                case 'fn':
                    if (node.children.length) {
                        let child = node.children[0];

                        // open the parent div
                        html += "<div class='freeform-row'>"; // parent

                        // child = (child.type === 'unary(')? child.children[0]: child;
                        let lines = this.getHeight(child);

                        // render symbol
                        let height = lines * 100;
                        html += "<div class='freeform-row freeform-trig-fn' style='font-size:"+height+"%'>"; // sym
                        html += node.txt;

                        // render power if required
                        if (node.power) {
                            html += "<div class='freeform-superscript'>"; // superscript
                            html += node.power;
                            html += "</div>"; // superscript
                        }
                        html += "</div>"; // sym

                        // render brackets and children
                        html += this.renderLeftBracket(lines);
                        html += this.render(child, false);
                        html += this.renderRightBracket(lines);

                        // close the parent div
                        html += "</div>"; // parent
                    }
                    break;

                case 'root':
                    if (node.children.length) {
                        let child = node.children[0];
                        let lines = this.getHeight(child);
                        let symSize     = lines * 100 + 10;
                        // child = (child.type === 'unary(')? child.children[0]: child;

                        // render the function symbol
                        html += "<div class='freeform-row freeform-sqrt'>"; // parent
                        html += "<div class='freeform-row' style='font-size:" + symSize + "%'>"; // sym
                        html += node.txt;
                        html += "</div>"; // sym

                        // render children
                        html += "<div class='freeform-row'>"; // children
                        html += this.render(child, false);
                        html += "</div>"; // children
                        html += "</div>"; // parent
                    }
                    break;

                case 'macro':
                    if (node.children.length) {
                        let child       = node.children[0];
                        // lookout for a range modifier encoded as a modifier
                        if (child.type === 'modifier' && child.decType === '..'){
                            node.rangeFrom  = child.decData[0];
                            node.rangeTo    = child.decData[1];
                            child           = child.children[0];
                        }
                        let lines       = this.getHeight(child);
                        let brSize      = lines * 100;
                        let symSize     = lines * 100 + 100;
                        let postSymSize = Math.round(10000/symSize);

                        // open the parent
                        html += "<div class='freeform-row freeform-macro'>";

                        // render the function symbol
                        html += "<div class='freeform-fn' style='font-size:" + symSize + "%'>" + node.txt + "</div>";

                        // Render range
                        if (node.rangeFrom + node.rangeTo != ""){
                            // render function args
                            this.fractionMode = 'single-line';
                            html += "<div class='freeform-macro-args'>"; // macro-args
                            html += "<div class='freeform-row'>" + this.render(node.rangeTo, false) + "</div>";
                            html += "<div class='freeform-row'>" + this.render(node.rangeFrom, false) + "</div>";
                            html += "</div>"; // macro-args
                            this.fractionMode = oldFractionMode;
                        }

                        // render children
                        html += "<div class='freeform-row'>";
                        html += this.render(child);
                        html += "</div>";

                        // close the parent
                        html += "</div>"; // macro-args
                    }
                    break;

                case 'id':
                    // deal with keywords
                    html += "<div class='freeform-spaced freeform-identifier freeform-atom'>";
                    if (this.keyWords.find(name => name === node.txt)) {
                        html += '&' + node.txt + ';';
                    } else {
                        html += node.txt;
                    }
                    html += "</div>";
                    break;

                case 'num':
                    // we're going to split the number up in order to render it with spacing like so: 10000.000001 => 10 000.000 001
                    let numParts = /([0-9]*)(([^0-9])([0-9]*))?/.exec(node.txt);
                    let numPartInt = numParts[1];
                    while (numPartInt.length > 3) {
                        html = "<div class='freeform-int-digit-group'>" + numPartInt.substr(numPartInt.length-3) + "</div>" + html;
                        numPartInt = numPartInt.substr(0, numPartInt.length - 3);
                    }
                    html = numPartInt + html + (numParts[3] ? numParts[3] : "");
                    numPartInt = numParts[4] ? numParts[4] : "";
                    while (numPartInt.length > 3) {
                        html += "<div class='freeform-decimal-digit-group'>" + numPartInt.substr(0,3) + "</div>";
                        numPartInt = numPartInt.substr(3);
                    }
                    html += numPartInt;

                    // wrap the number in a wrapper to hold it nicely together and allow css formatting
                    html = "<div class='freeform-row freeform-spaced freeform-number freeform-atom'>" + html + "</div>";
                    break;

                case 'err':
                    html += "<div class='freeform-row freeform-error'>";
                    html += node.txt;
                    html += "</div>";
                    break;

                case 'dump':
                    html += node.txt;
                    break;

                default:
                    console.error("Unrecognised node: ", node);
                    html += "<div class='freeform-row freeform-error'>";
                    html += node.txt;
                    html += "</div>";
                    break;
            }

            // deal with trailing primes
            if (node.prime) {
                let prime = node.prime;
                prime = prime.replace(new RegExp(/"|''/, 'g'), '&Prime;');
                prime = prime.replace(new RegExp(/'/, 'g'), '&prime;');
                html += prime;
            }

            // restore previous fraction mode
            this.fractionMode = oldFractionMode;

            return html;
        },

        buildExpressionTree: function(txt){
            let cleanTxt = this.cleanExpressionText(txt);
            let tokens = this.parseExpression(cleanTxt);

            if (this.parseErrors > 0) {
                console.error('ABORTING because parse errors found');
                return {
                    type:'dump',
                    txt: this.dumpTokens(tokens)
                };
            }

            // construct expression tree
            let tokenTree = this.constructTree(tokens);
            let cleanTree = this.cleanTree(tokenTree);

            return cleanTree;
        },

        // Public API Method
        // Determine whether an arbitrary bit of text looks like an expression
        isExpression: function(txt) {
            // if we contain sequences of operators that look numeric then call it an expression
            const operatorsRegex = /\^~|\^\^|\^_|[\w\d]^|__|_>|<=|>=|==|<>|\/=|!=|~=|=~|\.\/|[\-*/^+=<>~_()]/;
            if (operatorsRegex.test(txt) === true) {
                return true;
            }

            // if what we have looks like a number then call it an expression
            const numericRegex = /^\d*([\.,]\d+)?$/;
            if (numericRegex.test(txt) === true) {
                return true;
            }

            // if what we have is a word that matches one of the entries in the reserved words list then call it an expression
            let textParts = txt.match(/\w+/g);
            if (textParts && textParts.length === 1 && textParts[0] in this.keyWords){
                return true;
            }

            // all else failed so give up
            return false;
        },

            // Public API method
        // Generates beautified html, expanding out recognised text elements in an input text blob
        // The answers array contains sub-expression strings to be substituted into ?...? tokens
        beautifyExpression: function (txt, isSubExpression=false, answers=[]) {
            // stash away the answers vector for later use
            this.answers = answers;

            // tokenise the expression
            let expressionTree = this.buildExpressionTree(txt);

            // render the expression tree
            return this.renderTree(expressionTree, isSubExpression);
        },

        // Public API method
        // Generates beautified html, expanding out recognised text elements in an input text blob
        // The answers array contains sub-expression strings to be substituted into ?...? tokens
        beautify: function (txt, answers=[]) {
            // Start by cleaning up the input text to get it into the right general form
            let cleanTxt = this.cleanFullText(txt);

            // define the regular expression for tokenising input into the following:
            // '('      opening bracket (ignoring following white space)
            // '...'    anythin,g that isn't a bracket
            // ')'      closing bracket (ignoring any preceding white space)
            const regex = /(\()\s*|(\))\s*|([^()]+)/g;

            // setup work variables
            let result = "";
            let nestCount = 0;
            let accumulator = "";
            let openingText = "";

            // treat the text chunks as split by the tokeniser regex
            let a;
            while ((a = regex.exec(cleanTxt)) !== null) {
                if (a[1] === '(') {
                    if (nestCount++ === 0) {
                        // this is the first opening brace so store away previous text and reset accumulator to catch bracketed text chunk
                        result += openingText + accumulator;
                        accumulator = "";
                        openingText = a[0];
                        continue;
                    }
                } else if (a[2] === ')') {
                    // is this the special case of the bottom level nesting bracket?
                    if (nestCount && !--nestCount) {
                        // decide whether we have an expression
                        let isExpression = false;
                        isExpression = isExpression === true || (openingText !== '('); // assume '(' is not necessarily an expression but '( ' is always an expression
                        isExpression = isExpression === true || this.isExpression(accumulator);
                        if (isExpression === true) {
                            result += this.beautifyExpression(accumulator, false, answers);
                            accumulator = "";
                            openingText = "";
                            continue;
                        }
                    }
                }

                // by default add whatever we just matched to the accumulator (the openingText will not be duplicated here)
                accumulator += a[0];
            }

            return result + openingText + accumulator;
        },
        setQuestionContextName : function(name, instanceId) {
            this.questionContextName = name;
            this.instanceId = instanceId;
        }
    };
});
