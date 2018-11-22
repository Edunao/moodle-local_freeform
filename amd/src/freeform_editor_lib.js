/*eslint max-len: ["error", { "code": 200 }]*/
// define(['jquery', 'core/str', 'core/ajax'], function($, str, ajax) {
define('local_freeform/freeform_editor_lib', ["jquery","local_freeform/question_text_processor"], function($, questionTextProcessor) {

    let self = {
        signatureCache : [],

        processQuestionText: function(txt, answers) {
            // process question text, beautifying expressions and splitting out questions
            return questionTextProcessor.process(txt, answers);
        },

        getExpressions: function() {
            return questionTextProcessor.getQuestionExpressions();
        },

        getAnswers: function() {
            return questionTextProcessor.getQuestions();
        },

        ajaxCall: function(args) {
            $.ajax({
                dataType:   'json',
                type:       'POST',
                url:        M.cfg.wwwroot + '/local/freeform/ajax.php',
                data:       args.data,
                error:      args.onError,
                success:    function (ajaxResult) {
                    if ('error' in ajaxResult) {
                        args.onError(null,ajaxResult);
                        return;
                    }
                    args.onSuccess(ajaxResult);
                }
            });
        },

        generateInputSignature: function(inputTag, callback) {
            // fetch the question text
            let questionText = inputTag.val();

            self.generateSignature(questionText, function(signature){
                // check whether the value has changed since we put the request in
                let newQuestionText = inputTag.val();
                if (questionText !== newQuestionText){
                    console.log("Ignoring retrieved signature because value has changed:", inputTag.attr('name'), questionText, newQuestionText);
                    return;
                }

                // execute the callback
                callback(questionText, signature);
            });
       },

        generateQuestionSignature: function(questionName, callback) {
            // fetch the question text
            let questionidx = questionName.replace(/.*_(\d+)$/,"$1");
            let questionText = questionTextProcessor.getQuestionText(questionidx);

            self.generateSignature(questionText, function(signature){
                // check whether the value has changed since we put the request in
                let newQuestionText = questionTextProcessor.getQuestionText(questionidx);
                if (questionText !== newQuestionText){
                    console.log("Ignoring retrieved signature because value has changed:", questionName, questionText, newQuestionText);
                    return;
                }

                // execute the callback
                callback(questionText, signature);
            });
        },

        generateSignature: function(questionText, callback) {
            // if we already have the signature in out cache then reuse it
            if (questionText in self.signatureCache){
                let signature = self.signatureCache[questionText];
                callback(signature);
                return;
            }

            console.log("Requesting signature for expression: ", questionText);
            self.ajaxCall({
                data: {
                    action: 'generate_signature',
                    e: questionText
                },
                onSuccess: function (ajaxResult) {
                    let signature = ajaxResult.signature;

                    // cache the result
                    self.signatureCache[questionText] = signature;

                    // execute the calllback
                    callback(signature);
                },
                onError: function (data, response) {
                    console.error('Ajax error:', data, response);
                }
            });
        }
    };

    return self;
});

/*

 Page layout:
    header bar for text entry
        help button displays basic formula entry help for expression questions
        Help prompt at the top of the screen should initially say something along the lines of 'Click on a question mark to answer a question'
    body area
        text with embedded questions
        single stand alone questions as stand alone questions
        consecutive questions as Q ?A OR [H0] [H1] OR (H0) (H1) as a grid
        consecutive lines with multiple questions per line (optionally preceded by a line label ) as a grid or pyramid

 Examples

 ------------------ QCM

 This is a multiple choice example (all options are expressions):
 ?(
     (abc+def)*2
     2*a
     3*b
     4c
 )

 This is a multiple choice example (options are processes as normal text with potential sub-expressions):
 ?[
     (abc+def)*2
     (2*a)
     3*b
     4c
 ]

 This is a multiple choice example:
 ?[
 -    (abc+def)*2
 +    (2*a)
 -    3*b
 -    4c
 ]

 ------------------ Short answer

 This is a short answer question with the question and answer side by side in a table layout ?[Short Answer text]

 This is a set of short answer questions in a table [Answer is abc+3] ?(abc+3)
 This is a set of short answer questions in a table [Answer is 123] ?123

 This is a full width short answer question
 ?(some very complicated maths / expression)
 This is a number pyramid
(1)
(1)(1)
(1)(2)(1)
(1)(3)(3)(1)

This is a diamond
first line (?0)
line 1 (?2) ?(3)
last line (10)


 This is an in-line short ?(answer) question

 This is a wider in-line short answer question
 ?? width 3
 The ?(inline) question


 ------------------ Grids and pyramids

 This is a question grid
 [a]    [b]     (a+b)   (a*b)
 (1)    (2)     (3)     (2)
 (2)    (2)     (?3)    (?2)
 (?3)   (?3)    (6)     (9)

 This is a number pyramid
 (1)
 (1)(1)
 (1)(2)(1)
 (1)(3)(3)(1)

 This is a diamond
 first line (?0)
 line 1 (?2) ?(3)
 last line (10)

 ------------------ Sub expression

 ?? table
 These are sub-expression questions in a table: ( a + ?5 )
 These are sub-expression questions in a table: ( ? 5 a )
 These are sub-expression questions in a table: ( a + ?( 5 + b ) )
 These are sub-expression questions in a table: ( n_?1 = n_0 + 1 )
 These are sub-expression questions in a table: ( n^?1 = n^0 + 1 =  n^?(a+1) = n^(?2 + 1) )

 These are sub-expression questions: ( 1/?2 = ?2/4 = ?(a+b)/c = a/?(b+b) = (d+?e)/f = ?a²/b = a^?2/b )

 ------------------ Directives
 '... ?? <directive>[?? ...]?...' sets directives for the given question only
 '?? <directive>' alone on a line changes defaults (up until the next reset)
 Line with a '??' alone is a reset to question defaults
 '?? width <n>' where n is in range 1..5 corresponding to answer cell width of 2em, 5em, 10em, 20em, 40em
 '?? table [column widths]'
 '?? align [left|centre|right]'

 */
