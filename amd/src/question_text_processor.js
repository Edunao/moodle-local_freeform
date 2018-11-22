// define(['jquery', 'core/str', 'core/ajax'], function($, str, ajax) {
define('local_freeform/question_text_processor', ["jquery","local_freeform/expression_beautifier"], function($,expressionBeautifier) {

    return {
        // the answers container (for rendering answers into expressions containing questions)
        answers             : null,

        // the Questions containers
        questions           : null,
        questionExpressions : null,
        questionText        : null,
        isMultiline         : null,

        // directives (relating to questions
        defaultDirectives   : null,
        commonDirectives    : null,
        directives          : null,
        directiveText       : null,

        // lines of pre-processed clauses and current active clause
        emptyClause         : {type: "...", text: ""},
        currentClause       : null,
        lines               : null,

        // States:
        // 0: default
        // 1: ( ...
        // 2: ?( ...
        // 3: ?[ ....
        // 4: ( ... ?( ....
        // 5: ??...
        // 6: ( ... ?? ...
        // 7: [ ...
        state               : null,

        // miscellaneous work variables
        tokenIdx            : null, // advancement pointer in input tokens list for parse() method
        nestDepth           : null,
        expressionIdx       : null,

        consumeNextToken: function(){
            ++this.tokenIdx;
        },

        rewindNextToken: function(){
            --this.tokenIdx;
        },

        initQuestion: function(){
            this.isMultiline = false;
            this.questionText = "";
        },

        initExpression: function(){
            this.nestDepth = 1;
            ++this.expressionIdx;
        },

        initSubExpression: function(){
            this.stackedNestDepth = this.nestDepth;
            this.nestDepth = 1;
        },

        endSubExpression: function(){
            this.nestDepth = this.stackedNestDepth;
        },

        // parse a directive string and apply the resulting settings to the given directives container
        applyDirective: function(directivesCointainer, directiveText){
            let cleanText = directiveText.replace(/&nbsp;/g, " ");
            let a;

            // aligned - table display mode
            if (/^\s*aligned\s*$/i.test(cleanText) === true) {
                directivesCointainer.tblStyle = "aligned";

            // grid - table display mode
            } else if (/^\s*grid\s*$/i.test(cleanText) === true){
                directivesCointainer.tblStyle = "grid";

            // labels - table display mode
            } else if (/^\s*labels\s*$/i.test(cleanText) === true){
                directivesCointainer.tblStyle = "labels";

            // lines - table display mode
            } else if (/^\s*lines\s*$/i.test(cleanText) === true){
                directivesCointainer.tblStyle = "lines";

            // boxes - table display mode
            } else if ( (a = /^\s*boxes(\s+\d+)?\s*$/i.exec(cleanText) ) !== null){
                directivesCointainer.tblStyle = "boxes";
                if (a[1] > 0) {
                    directivesCointainer.cellSize = a[1];
                }

            // header - table display option
            } else if (/^\s*header\s*$/i.test(cleanText) === true){
                directivesCointainer.hasHeaderLine = true;

            } else {
                console.warn("Unrecognised directive:", cleanText);

            }
        },

        tokenise: function(txt) {
            let tokens = [];
            let tokenCount = 0;
            const tokeniserRegex = /(\s+)|\s*<(br\b|p\b|\/p\b)[^>]*>\s*|(\()|(\[)|(\))|(])|\s*(\?\?)\s*|(\?)|(<[^>]*>)|([^()[\]?<\s;]+|.)/g;
            /*
             tokens:
             ([\s\n\r]+)                1: White space
             \s*(<br>|<p>|<\/p>)\s*     2: <br>, <p>, </p>, <h.>, </h.>
             (\()                       3: (
             (\[)                       4: [
             (\))                       5: )
             (])                        6: ]
             (\?\?)                     7: ??
             (\?)                       8: ?
             (<[^>]*>)                  9: html tag (<...>)
             ([^()[\]?<\s\n\r]+|.)     10: Anything else
             */
            let matches;
            while ((matches = tokeniserRegex.exec(txt)) !== null) {
                // identify the match text
                let matchText   = "";
                let matchCase   = 0;
                for(let i=1; i < matches.length; ++i){
                    if (matches[i]){
                        matchText = matches[i];
                        matchCase = i;
                        break;
                    }
                }
                tokens[tokenCount++]={
                    type: matchCase,
                    text: matchText
                }
            }

            return tokens;
        },

        addQuestion: function(qType, qText){
            // assign an identifier to the new question
            let questionId = this.questions.length;

            // store away the question in the questions container
            this.questions[questionId] = {
                type        : qType,
                text        : qText,
                expression  : (qType === '(?())' || qType === '(?...)')? this.expressionIdx: null,
                directives  : JSON.parse(JSON.stringify(this.directives)),
                multiline   : this.isMultiline,
            };

            // clean out any question-specific directives
            this.directives = JSON.parse(JSON.stringify(this.commonDirectives));

            // return the question identifier string
            return " ?" + questionId + "? ";
        },

        addLine: function(){
            // if the last active clause was empty then throw it away
            if (this.currentClause === this.emptyClause){
                this.lines[this.lines.length - 1].parts.pop();
            }
            // create a new active clause
            this.currentClause = JSON.parse(JSON.stringify(this.emptyClause));
            let directives = JSON.parse(JSON.stringify(this.directives));
            this.lines.push({parts:[this.currentClause], directives: directives, nextQuestionId: this.questions.length});
        },

        addClause: function(clause){
            // if the last active clause was empty then just keep going with it
            if (this.currentClause === this.emptyClause){
                return;
            }
            // create a new active clause
            this.currentClause = JSON.parse(JSON.stringify(clause));
            this.lines[this.lines.length - 1].parts.push(this.currentClause);
        },

        addQuestionClause: function(qType, qText){
            // register the new question
            let qIdText = this.addQuestion(qType, qText);
            // write the question's place-holder string to a new clause of its own
            this.addClause({type: (qType=="?()" ? "?()" : "?"), text: qIdText, qType: qType});
            // close the question clause by opening a new empty clause after it
            this.addClause(this.emptyClause);
        },

        filterTag: function(token) {
            // ignore anything that isn't a link or an image
            let tagNames = token.text.match(/^<\/?(\w+)/);
            let tagName = (tagNames ? tagNames[1] : "");
            switch (tagName){
                // solid tags
                case "a":
                case "image":
                case "img":
                case "table":
                case "tr":
                case "th":
                case "td":
                case "li":
                case "ul":
                case "ol":
                case "div":
                    return token.text;

                // white space tags
                case "strong":

                // anything else (script tags, style tags, etc ...
                default:
                    return ' ';
            }
        },

        processTokenForDefaultState: function(token, nextToken){
            switch (token.type) {
                case 2: // <br>|<p>|</p>
                    // ignore opening <p> clause at start of text
                    if (token.text === "p" && this.tokenIdx === 1) {
                        break;
                    }
                    // don't insert spurious <br> at start of <p> clauses if not required
                    if ((token.text === "br" || token.text === "/p") && nextToken.text === "p") {
                        this.consumeNextToken();
                    }
                    // convert <p> and </p> tags into <br> tags
                    this.addLine();
                    break;

                case 3: // (
                    this.state = 1;
                    this.initExpression();
                    this.addClause({type: "()", text: "", multiline: false, numeric: false});
                    // if the bracket is immediately followed by white space then treat as numeric
                    if (nextToken.type === 1) {
                        this.currentClause.numeric = true;
                        this.consumeNextToken();
                    }
                    break;

                case 4: // [
                    this.state = 7;
                    this.addClause({type: "[]", text: "", multiline: false});
                    break;

                case 7: // ??
                    // switch to the 'directives' parser state
                    this.state = 5;
                    this.directiveText = "";
                    break;

                case 8: // ?
                    this.initQuestion();
                    switch (nextToken.type) {
                        case 3: // ?(
                            // switch to the new parser state to parse the question clause
                            this.state = 2;
                            this.initExpression();
                            this.consumeNextToken();
                            break;
                        case 4: // ?[
                            // switch to the new parser state to parse the question clause
                            this.state = 3;
                            this.consumeNextToken();
                            break;
                        case 10: // ?...
                            let qType = expressionBeautifier.isExpression(nextToken.text)? '?()': '?...';
                            this.addQuestionClause(qType, nextToken.text);
                            this.consumeNextToken();
                            break;
                        default: // ? ...
                            // treat the question mark as arbitrary text
                            this.currentClause.text += token.text;
                    }
                    break;

                case 9: // <...>
                    // ignore anything that isn't a link or an image
                    this.currentClause.text += this.filterTag(token);
                    return;

                default:
                    // accumulate the text for this token into the current active result node
                    this.currentClause.text += token.text;
            }
        },

        processTokenForExpressionState: function(token, nextToken){
            switch (token.type) {
                case 2: // <...>
                    if (this.nestDepth === 1) {
                        this.currentClause.multiline = true;
                        this.currentClause.text += "\n";
                    }
                    return;

                case 3: // (
                    ++this.nestDepth;
                    this.currentClause.numeric = true;
                    break;

                case 5: // )
                    // un-nest
                    if (--this.nestDepth === 0) {
                        // we've finished un-nesting so return to the default state
                        this.state = 0;
                        this.addClause(this.emptyClause);
                        return;
                    }
                    break;

                case 7: // ??
                    // switch to the 'in-expression-directive' parser state
                    this.state = 6;
                    this.directiveText = "";
                    return;

                case 8: // ?
                    this.initQuestion();
                    switch (nextToken.type) {
                        case 3: // ?(
                            this.state = 4;
                            this.currentClause.type = (this.currentClause.type === "...") ? "(?)" : "(??)";
                            this.initSubExpression();
                            this.consumeNextToken();
                            return;
                        case 10: // ?...
                            this.currentClause.text += this.addQuestion("(?...)", expressionBeautifier.cleanExpressionText(nextToken.text));
                            this.currentClause.type = (this.currentClause.type === "...") ? "(?)" : "(??)";
                            this.consumeNextToken();
                            return;
                    }
                    break;

                case 9: // <...>
                    // don't allow tags inside brackets
                    this.currentClause.text += ' ';
                    return;

                case 10: // .
                    // if we hit a ';' at the root level then split into separate clauses
                    if (token.text === ';' && this.nestDepth === 1){
                        this.addClause({type: "()", text: "", multiline: false, numeric: false});
                        this.initExpression();
                        return;
                    }
            }
            // accumulate the text for this token into the current active result node
            this.currentClause.text += token.text;
        },

        processTokenForExpressionQuestionState: function(token, nextToken){
            switch (token.type) {
                case 2: // <...>
                    if (this.nestDepth === 1) {
                        this.isMultiline = true;
                        this.questionText += "\n";
                    }
                    return;

                case 3: // (
                    ++this.nestDepth;
                    break;

                case 5: // )
                    // un-nest
                    if (--this.nestDepth === 0) {
                        // we've finished unnesting so return to the default state, inserting the question place-holder and storing away the question text
                        this.state = 0;
                        this.addQuestionClause("?()", expressionBeautifier.cleanExpressionText(this.questionText));
                        return;
                    }
                    break;

                case 7: // ??
                case 8: // ?
                case 9: // <...>
                    // ignore nested '?', '??' and '<...>' that we don't know how to deal with (we use the '?' as a reserved character)
                    this.questionText += " ";
                    return;

                case 10: // .
                    // if we hit a ';' at the root level then split into separate clauses
                    if (token.text === ';' && this.nestDepth === 1){
                        // finalise the existing question
                        this.addQuestionClause("?()", expressionBeautifier.cleanExpressionText(this.questionText));
                        // begin a new question
                        this.initQuestion();
                        this.initExpression();
                        return;
                    }
            }
            // accumulate the text for this token into the current active result node
            this.questionText += token.text;
        },

        processTokenForBlockQuestionState: function(token, nextToken){
            switch (token.type) {
                case 2: // <br>|<p>|</p>
                    this.isMultiline = true;
                    this.questionText += "\n";
                    return;

                case 6: // ]
                    // return to the default state, inserting the question place-holder and storing away the question text
                    this.state = 0;
                    this.addQuestionClause("?[]", this.questionText);
                    return;

                case 7: // ??
                case 8: // ?
                case 9: // <...>
                    // ignore stuff '?' and '??' that we don't know how to deal with (we use the '?' as a reserved character)
                    this.questionText += ' ';
                    return;
            }
            // accumulate the text for this token into the current active result node
            this.questionText += token.text;
        },

        processTokenForSubexpressionQuestionState: function(token, nextToken){
            switch (token.type) {
                case 3: // (
                    ++this.nestDepth;
                    break;

                case 5: // )
                    // un-nest
                    if (--this.nestDepth === 0) {
                        // we've finished unnesting so return to the default state, inserting the question place-holder and storing away the question text
                        this.state = 1;
                        this.currentClause.text += this.addQuestion("(?())", expressionBeautifier.cleanExpressionText(this.questionText));
                        this.endSubExpression();
                        return;
                    }
                    break;

                case 2: // <p>|</p>|<br>
                case 7: // ??
                case 8: // ?
                case 9: // <...>
                    // ignore stuff that's out of place in a question
                    this.questionText += " ";
                    return;
            }
            // accumulate the text for this token into the current active result node
            this.questionText += token.text;
        },

        processTokenForDirectiveState: function(token, nextToken){
            switch (token.type) {
                case 2: // <p>|</p>|<br>
                    if (this.directiveText) {
                        // we have content so append it to the directives vector
                        this.applyDirective(this.commonDirectives, this.directiveText);
                    } else {
                        // we have no content so consider this to be a reset
                        this.commonDirectives = JSON.parse(JSON.stringify(this.defaultDirectives));
                    }

                    // make sure that changes are reflected down to the local directives vector (for the next question to be processed)
                    this.directives = JSON.parse(JSON.stringify(this.commonDirectives));

                    // push the current token back into the 'to be processed' queue and return to default parse mode
                    this.state = 0;
                    this.rewindNextToken();
                    return;

                case 7: // ??
                case 8: // ?
                    // this is a local directive so store it away for immediate use
                    this.applyDirective(this.directives, this.directiveText);

                    // push the current token back into the 'to be processed' queue and return to default parse mode
                    this.state = 0;
                    this.rewindNextToken();
                    return;

                case 9: // <...>
                    // ignore stuff that's out of place in a question
                    this.directiveText += " ";
                    return;
            }
            // accumulate the text for this token into the current active result node
            this.directiveText += token.text;
        },

        processTokenForExpressionDirectiveState: function(token, nextToken){
            switch (token.type) {
                case 3: // (
                case 5: // )
                    if (this.directiveText) {
                        // we have content so append it to the directives vector
                        this.applyDirective(this.commonDirectives, this.directiveText);
                    } else {
                        // we have no content so consider this to be a reset
                        this.commonDirectives = JSON.parse(JSON.stringify(this.defaultDirectives));
                    }

                    // make sure that changes are reflected down to the local directives vector (for the next question to be processed)
                    this.directives = JSON.parse(JSON.stringify(this.commonDirectives));

                    // push the current token back into the 'to be processed' queue and return to default parse mode
                    this.state = 1;
                    this.rewindNextToken();
                    return;

                case 7: // ??
                case 8: // ?
                    // this is a local directive so store it away for immediate use
                    this.applyDirective(this.directives, this.directiveText);

                    // push the current token back into the 'to be processed' queue and return to expression parse mode
                    this.state = 1;
                    this.rewindNextToken();
                    return;

                case 9: // <...>
                    // ignore stuff that's out of place in a question
                    this.directiveText += " ";
                    return;
            }
            // accumulate the text for this token into the current active result node
            this.directiveText += token.text;
        },

        processTokenForBlockState: function(token,nextToken){
            switch (token.type) {
                case 2: // <br>
                    // we've hit a line break of some kind so change the type of the current clause back to "..." and switch back to default parser
                    this.state = 0;
                    this.currentClause.type = "...";
                    this.currentClause.text = "[" + this.currentClause.text;
                    this.rewindNextToken();
                    return;

                case 6: // ]
                    // we've matched the closing bracket so close the clause
                    this.state = 0;
                    this.addClause(this.emptyClause);
                    return;
            }
            // default case: accumulate the text for this token into the current active result node
            this.currentClause.text += token.text;
        },

        processTokens: function(tokens) {
            while ( this.tokenIdx < tokens.length ) {
                let token = tokens[this.tokenIdx++];
                let nextToken = (this.tokenIdx < tokens.length)? tokens[this.tokenIdx]: {type:1,text:""};
                switch ( this.state ) {
                    // default state:
                    case 0:
                        this.processTokenForDefaultState(token,nextToken);
                        break;

                    // ( ... state
                    case 1:
                        this.processTokenForExpressionState(token,nextToken);
                        break;

                    // ?( ... state
                    case 2:
                        this.processTokenForExpressionQuestionState(token,nextToken);
                        break;

                    // ?[ ... state
                    case 3:
                        this.processTokenForBlockQuestionState(token, nextToken);
                        break;

                    // 4: ( ... ?( .... state
                    case 4:
                        this.processTokenForSubexpressionQuestionState(token, nextToken);
                        break;

                    // 5: ??... state
                    case 5:
                        this.processTokenForDirectiveState(token, nextToken);
                        break;

                    // 6: ( ... ?? ... state
                    case 6:
                        this.processTokenForExpressionDirectiveState(token, nextToken);
                        break;

                    // 7: [ ... state
                    case 7:
                        this.processTokenForBlockState(token, nextToken);
                        break;
                }
            }
        },

        qualifyLines: function() {
            // identify line types and filter out unimportant line parts
            for (let i=0; i < this.lines.length; ++i){
                let theLine = this.lines[i];

                // TODO: Add management of lines composed of expessions and semicolons here
                // copy out everything that isn't white space into the keyParts container
                let keyParts = [];
                let isolate = false;
                for (let j=0; j < theLine.parts.length; ++j){
                    let thePart = theLine.parts[j];

                    // is this a blank chunk that we can ignore when identifying table columns
                    if (thePart.type === "..." && /\S/.test(thePart.text) === false){
                        continue;
                    }

                    // is this non-breakable space floating about at the start of a line - so we can ignore it
                    if (keyParts.length === 0 && thePart.type === "..." && /^(&nbsp;)+$/.test(thePart.text) === true){
                        continue;
                    }

                    // TODO
//                    // think about re-processing ... clauses
//                    if (thePart.type === "...") {
//                       // if this looks like an expression and it's followed by a semicolon or end of line then treat it as an expression
//                        let possilbeExpression = (j === theLine.parts.length - 1) || (theLine.parts[j+1].text === ';');
//                        if ((possilbeExpression === true) && expressionBeautifier.isExpression(thePart.text)){
//                            thePart.type = '()';
//                        } else if ((keyParts.length > 0) && keyParts[keyParts.length-1].type === '...') {
//                            // this isn't an expression so merge it back inot the previous node
//                            keyParts[keyParts.length-1].text += thePart.text;
//                            continue;
//                        }
//                    }

                    // TODO
//                    // if this is a semicolon then try to ignore it
//                    if (thePart.text === ';'){
//                        if (keyParts.length === 0){
//                            keyParts.push(JSON.parse(JSON.stringify(this.emptyClause)));
//                        } else if (theLine.parts[j-1].type === '()') {
//                            continue;
//                        }
//                        if ((j < theLine.parts.length - 1) && expressionBeautifier.isExpression(theLine.parts[j+1])) {
//                            continue;
//                        }
//                        keyParts[keyParts.length-1].text += ';';
//                        continue;
//                    }

                    keyParts.push(thePart);
                    isolate = isolate || ("isMultiline" in thePart && thePart.isMultiline === true);
                    isolate = isolate || (keyParts.length > 1 && thePart.type === "...");
                }
                if (keyParts.length === 0){
                    // the line is empty so skip on
                    theLine.type = "blank";
                    continue;
                }
                if (isolate === true){
                    // there's some multi-line content or suchlike in this 'line' so it shouldn't be globbed into a table
                    theLine.type = "para";
                    continue;
                }
                if (keyParts.length === 1 && keyParts[0].type === "..."){
                    // the text contains only normal text so treat as a paragraph case
                    theLine.type = "para";
                    continue;
                }

                // the different 'paragraph' cases have been covered so we must have a multi-part case that could be filled into a table
                theLine.type = "tbl";
                theLine.parts = keyParts;
            }
        },

        // render a chunk of inline content, giving special treatment to questions and beautifying expressions
        renderInlineElement: function(part) {
            let qIdMatches  = part.text.match(/\?([0-9]+)\?/);
            let qId         = qIdMatches ? qIdMatches[1].replace(/\?/g,'') : null;
            let qName       = 'ffq__' + qId;
            switch(part.type){
                case "?":
                    return "<label id='" + qName + "' for='" + qName + "' class='freeform-inline question'>?</label>";
                case "?()":
                    return "<label id='" + qName + "' for='" + qName + "' class='freeform-inline question full-expression'>?</label>";
                case "(?)":
                case "(??)":
                    this.questionExpressions[qId] = part.text;
                    let renderedExpression = expressionBeautifier.beautify("( " + part.text + ")", this.answers);
                    return " <label id='" + qName + "' for='" + qName + "' class='inline question expression'>" + renderedExpression + "</label> ";
                case "()":
                    return expressionBeautifier.beautify("(" + part.text + ")", this.answers);
                default:
                    return part.text;
            }
        },

        // render content for a table cell, giving special treatment to question cells and beautifying expressions
        renderTableElement: function(parent, part) {
            let qIdMatches  = part.text.match(/\?([0-9]+)\?/);
            let qId         = qIdMatches ? qIdMatches[1].replace(/\?/g,'') : null;
            let qName       = 'ffq__' + qId;
            let node        = $("<label>").appendTo(parent);
            switch(part.type){
                case "?":
                    parent.parent().attr("for", qName);
                    node.addClass("question").attr("for", qName).attr("id", qName);
                    node.append("?");
                    break;
                case "?()":
                    parent.parent().attr("for", qName);
                    node.addClass("question full-expression").attr("for", qName).attr("id", qName);
                    node.append("?");
                    break;
                case "(?)":
                case "(??)":
                    this.questionExpressions[qId] = part.text;
                    parent.parent().attr("for", qName);
                    node.addClass("question expression").attr("id", qName).attr("for", qName);
                    node.append(expressionBeautifier.beautify("( " + part.text + ")"), this.answers);
                    break;
                case "()":
                    node.append(expressionBeautifier.beautify("( " + part.text + ")"), this.answers);
                    break;
                default:
                    node.append(part.text);
                    break;
            }
        },

        // display a grid with the same number of columns on every line
        renderTableAsGrid: function(cssClass, tblLines, hasLabels, headerLine) {
            let result = $("<table class='freeform-"+cssClass+"'>");
            for (let i=0; i< tblLines.length; ++i) {
                let row    = $("<tr>").appendTo(result);
                if (i === 0 && tblLines.length > 1 && tblLines[1].parts.length > tblLines[0].parts.length){
                    $("<th>").attr("style","border:0").appendTo(row);
                }
                let colTag = (hasLabels === true)? "<th>": "<td>";
                for (let j=0; j< tblLines[i].parts.length; ++j) {
                    let col = $((headerLine === true) ? "<th>" : colTag).appendTo(row);
                    col = $("<div>").addClass("flexparent").appendTo(col);
                    this.renderTableElement(col, tblLines[i].parts[j]);
                    colTag = "<td>";
                }
                headerLine = false;
            }
            return result;
        },

        // display a 2 column table where the left column is the label and the right column contains different numbers of elements from one line to the next
        renderTableAsLabeledLines: function(cssClass, tblLines, headerLine) {
            let result = $("<table class='freeform-"+cssClass+"'>");
            for (let i=0; i< tblLines.length; ++i) {
                let row  = $("<tr>").appendTo(result);
                let col0 = $("<th>").appendTo(row);
                let col1 = $((headerLine === true) ? "<th>" : "<td>").appendTo(row);
                col0 = $("<div>").addClass("flexparent").appendTo(col0);
                col1 = $("<div>").addClass("flexparent").appendTo(col1);
                if (i === 0 && tblLines[0].parts.length === 1){
                    this.renderTableElement(col1, tblLines[i].parts[0]);
                } else if (tblLines[i].parts[0].text !== ""){
                    this.renderTableElement(col0, tblLines[i].parts[0]);
                }
                for (let j=1; j< tblLines[i].parts.length; ++j) {
                    this.renderTableElement(col1, tblLines[i].parts[j]);
                }
                headerLine = false;
            }
            return result;
        },

        // display a single column table in which there are different numbers of elements from one line to the next
        renderTableAsLines: function(cssClass, tblLines, headerLine) {
            let result = $("<table class='freeform-"+cssClass+"'>");
            for (let i=0; i< tblLines.length; ++i) {
                let row = $("<tr>").appendTo(result);
                let col = $("<td>").appendTo(row);
                col = $("<div>").addClass("flexparent").appendTo(col);
                for (let j=0; j< tblLines[i].parts.length; ++j) {
                    this.renderTableElement(col, tblLines[i].parts[j]);
                }
                headerLine = false;
            }
            return result;
        },

        // display a single column table in which there are different numbers of elements from one line to the next
        renderTableAsBoxes: function(cssClass, tblLines, headerLine) {
            let result = $("<table class='freeform-"+cssClass+"'>");
            for (let i=0; i< tblLines.length; ++i) {
                let row = $("<tr>").appendTo(result);
                let col = $((headerLine === true) ? "<th>" : "<td>").appendTo(row);
                for (let j=0; j< tblLines[i].parts.length; ++j) {
                    this.renderTableElement(col, tblLines[i].parts[j]);
                }
                headerLine = false;
            }
            return result;
        },

        renderTable: function(tblLines, directives) {
            // determine the basic shape of the grid
            let hasLabels = true;
            let delta = 0;
            let isRegular = true;
            let lastLength = 0;
            for (let i = 0; i< tblLines.length; ++i){
                lastLength = tblLines[i].parts.length;
                hasLabels = hasLabels === true && tblLines[i].parts[0].type !== "?" && tblLines[i].parts[0].type !== "(?)" && tblLines[i].parts[0].type !== "(??)";
                if (i === 2){
                    delta = tblLines[2].parts.length - tblLines[1].parts.length;
                } else if (i > 2) {
                    isRegular = (isRegular === true) && (delta === tblLines[i].parts.length - tblLines[i-1].parts.length);
                }
            }

            // decide whether we have a header line or not
            let headerLine = directives.hasHeaderLine;
            if (headerLine === null && isRegular === true && tblLines.length > 2){
                if (delta === 0) {
                    // this is a classic grid so assume that if the top line is lacking one cell then it's a header line
                    let shortFirstLine = (tblLines[0].parts.length === tblLines[1].parts.length - 1);
                    let emptyFirstCell = (tblLines[0].parts.length === tblLines[1].parts.length && tblLines[0].parts[0].txt === "");
                    headerLine = (shortFirstLine || emptyFirstCell);
                } else {
                    // this is a pyramid or an inverted pyramid so if the first line is of a different shape then assume it's a header line
                    headerLine = (delta !== tblLines[1].parts.length - tblLines[0].parts.length);
                }
            }

            // determine the table style to apply
            let tblStyle = directives.tblStyle;
            if (tblStyle === ""){
                if (isRegular === true && delta === 0){
                    tblStyle = (lastLength === 2)? "aligned": "grid";
                } else if (hasLabels) {
                    tblStyle = "labels";
                } else {
                    tblStyle = (isRegular === true)? "boxes": "lines";
                }
            }

            // construct the table using one of various rule sets depending on how the table was setup
            let result = "";
            switch(tblStyle){

                case "aligned":
                    // the table has a standard number of columns so display it as a table
                    result = this.renderTableAsGrid("aligned", tblLines, hasLabels, headerLine);
                    break;

                case "grid":
                    // the table has a standard number of columns so display it as a table
                    result = this.renderTableAsGrid("grid", tblLines, hasLabels, headerLine);
                    break;

                case "labels":
                    // the table has an irregular shape but has left column labels so display it in 2 columns
                    result = this.renderTableAsLabeledLines("lines", tblLines, headerLine, directives.cellSize);
                    break;

                case "lines":
                    // the table has an irregular shape but no left column labels so display it in 1 column
                    result = this.renderTableAsLines("lines", tblLines, headerLine, directives.cellSize);
                    break;

                case "boxes":
                    // the table has an irregular shape but no left column labels so display it in 1 column
                    result = this.renderTableAsBoxes("boxes", tblLines, headerLine, directives.cellSize);
                    break;
            }

            // convert the result back to html
            let container = $("<div>");
            container.append(result);
            return container.html();
        },

        // we want to identify the 'last question before END of' line instead of 'last question before START of'
        locateQuestionsInLines: function() {
            let holdValue = this.questions.length;
            let lastValue = this.questions.length;
            for (let i = this.lines.length - 1 ; i >= 0 ; i--){
                if (this.lines[i].type === "tbl") {
                    this.lines[i].lastQuestionId = holdValue;
                } else {
                    this.lines[i].lastQuestionId = lastValue;
                    holdValue = this.lines[i].nextQuestionId;
                }
                lastValue = this.lines[i].nextQuestionId;
            }
        },

        renderInputSet: function(questionIdsBegin, questionIdsEnd) {

            // if we have no inputs to render then we're done
            if (questionIdsEnd <= questionIdsBegin) {
                return "";
            }

            let result = $('<div>');
            let inputSet = $('<div>').addClass('input-set').attr('for', 'ffq__' + questionIdsBegin).appendTo(result);
            let inputRow = null;
            let lastExpression = null;
            for (let questionId = questionIdsBegin; questionId < questionIdsEnd; ++questionId){

                // group all inputs for sub-questions of the same expression into a single row
                let expression = this.questions[questionId].expression;
                if (expression === null || lastExpression !== expression){
                    inputRow = $('<div>').addClass('input-row').attr('name','ffq__' + questionId).appendTo(inputSet);
                }
                lastExpression = expression;

                // add the input cell as an input column within the input row
                let inputCol = $('<div>').addClass('input-col').attr('for','ffq__' + questionId).appendTo(inputRow);
                $('<input>').attr('type','text').attr('name','ffq__' + questionId).appendTo(inputCol);
            }

            return result.html();
        },

        renderLines: function() {
            let result = "";
            let questionIdsBegin;
            let questionIdsEnd = 0;
            for (let i=0; i < this.lines.length; result += this.renderInputSet(questionIdsBegin, questionIdsEnd)){
                // define the question range that will need to be rendered at the end of the sequence that we're going to deal with here
                questionIdsBegin = questionIdsEnd;
                questionIdsEnd = this.lines[i].lastQuestionId;

                // for sequences of consecutive blank lines, apply a single '<br>'
                if (this.lines[i].type === "blank"){
                    // skip any consecutive blanks
                    do{
                        ++i;
                    } while (i < this.lines.length && this.lines[i].type === "blank");

                    // as long as this isn't at the end of the text buffer append a blank to the accumulator
                    if (i < this.lines.length) {
                        result += "<br>";
                    }
                    continue;
                }

                // group together a consecutive set of lines that look like they belong in a table
                if (this.lines[i].type === "tbl"){
                    let directives = this.lines[i].directives;
                    let tblLines = [];
                    do{
                        tblLines.push(this.lines[i]);
                        ++i;
                    } while (i < this.lines.length && this.lines[i].type === "tbl");
                    result += this.renderTable(tblLines, directives);
                    continue;
                }

                // treat anything that isn't a blank line or an expression as text to append
                // so suck up the parts in the paragraph beautifying the expressions
                for (let j = 0; j < this.lines[i].parts.length; ++j){
                    let thePart = this.lines[i].parts[j];
                    result += this.renderInlineElement(thePart);
                }

                // add a line break for the end of line that we just processed
                result += "<br>";
                ++i;
            }

            return result;
        },

        getQuestionText: function(questionIdx){
            if (questionIdx >= this.questions.length){
                console.error("Failed to identify question: ", questionIdx);
                return "";
            }
            return ((this.questions[questionIdx].type === '?[]') ? ':txt:' : '') + this.questions[questionIdx].text;
        },

        getQuestionExpressions: function() {
            return this.questionExpressions;
        },

        getQuestions: function() {
            return this.questions;
        },

        process: function(txt, answers) {
            // initialise key properties before we begin
            this.answers                = answers;
            this.questions              = [];
            this.questionExpressions    = [];
            this.questionText           = "";
            this.isMultiline            = false;
            this.defaultDirectives      = { tblStyle: "", cellSize:10, hasHeaderLine: null, answerProveccingOptions: [] };
            this.commonDirectives       = JSON.parse(JSON.stringify(this.defaultDirectives));
            this.directives             = JSON.parse(JSON.stringify(this.defaultDirectives));
            this.directiveText          = "";
            this.currentClause          = JSON.parse(JSON.stringify(this.emptyClause));
            this.lines                  = [ {parts:[this.currentClause],directives:this.defaultDirectives} ];
            this.state                  = 0;
            this.tokenIdx               = 0;
            this.nestDepth              = 0;
            this.expressionIdx          = -1;

            // tokenise the text, chunking it up into logical 'tokens'
            let tokens   = this.tokenise(txt);

            // process the token, gathering them together to form 'lines' composed of 'parts' and extract the question descriptions
            this.processTokens(tokens);

            // determine how lines should be grouped for display purposes
            this.qualifyLines();

            // determine which questions will be treated in which lines
            this.locateQuestionsInLines();

            // render the lines to an html string
            let html = "<div id='ffq__root' class='freeform-root freeform'>" + this.renderLines() + "</div>";
            console.log('SETTING FREEFORM-ROOT');

            // return the results
            return {html: html, questions: this.questions};
        }
    };
});
