/*eslint max-len: ["error", { "code": 200 }]*/

//define(["jquery"], function($) {
define('local_freeform/freeform_execution_lib', ["jquery","local_freeform/expression_beautifier"], function($, expressionBeautifier) {

    let self = {
        answers         : null,
        expressions     : null,
        currentInput    : null,
        currentLabel    : null,
        lastVal         : null,
        prevVal         : null,
        heartbeatId     : null,

        init: function(updateCallback) {
            // if the heartbeat is already setup then no need to do it again
            if (self.heartbeatId !== null){
                return;
            }

            console.log("Setting up event freeform heartbeat for user input processing");

            // Setup a timer to monitor input changes and update formatted text each time user pauses their typing
            self.heartbeatId = setInterval(
                function(){

                    // if we don't have an active input element then give up
                    if (self.currentInput === null || self.currentInput.length === 0){
                        return;
                    }

                    // if the value is still changing (because the user is still typing) then give up
                    let currentVal = self.currentInput.val();
                    if (currentVal !== self.lastVal){
                        self.lastVal = currentVal;
                        return;
                    }

                    // there has been a change and the user has paused (stopped typing) so apply it
                    self.update_current_label(updateCallback);
                },
                150
            );
        },

        reset: function() {
            console.log('freeform_execution_lib reset');
            this.currentInput    = null;
            this.currentLabel    = null;
            this.lastVal         = null;
            this.prevVal         = null;

            expressionBeautifier.setQuestionContextName("","");
        },

        setExpressions: function(expressions, uniqueId="") {
            this.expressions[uniqueId] = expressions;
        },

        setAnswers: function(uniqueId, answers) {
            this.answers[uniqueId] = answers;
        },

        getAnswers: function(uniqueId="") {
            return this.answers[uniqueId];
        },

        hook_events: function(uniqueId="", focusCallback=null) {
            console.log("Hooking up event listeners for freeform question navigation");

            rootNodes  = $("#ffq_" + uniqueId + "_root");
            inputSets  = rootNodes.find("div.input-set");
            inputNodes = inputSets.find("input");

            // hook a click handler for managing click on inputSets to access first of their input nodes
            inputSets.click(function (e) {
                // lookup the target for the label that we clicked on
                let clickTarget = $(e.target);
                let inputName = clickTarget.attr('for');

                // locate the input element with a name matching the id of the label
                let inputNode = $("input[name='" + inputName + "']");

                // give focus to the selected input element
                inputNode.focus();

                // stop propagation
                e.stopPropagation();
            });

            // hook a click handler for managing click on labels to access input fields
            rootNodes.click(function (e) {
                // lookup the target for the label that we clicked on
                let clickTarget = $(e.target);
                while(!clickTarget.attr("for")) {
                    if (!(clickTarget.length > 0)) {
                        return;
                    }
                    clickTarget = clickTarget.parent();
                }
                let labelTarget = clickTarget.attr('for');

                // locate the input element with a name matching the id of the label
                let inputNode = $("input[name='" + labelTarget + "']");

                // give focus to the selected input element
                inputNode.focus();

                // stop propagation
                e.stopPropagation();
            });

            // hook a focus event handler to manage highlighing of labels corresponding to input fields
            inputNodes.focus(function(e) {
                // lookup the name field of the focussed input element
                let eventTarget = $(e.target);
                let inputNode   = $(eventTarget);
                let inputCol    = inputNode.parent();
                let inputRow    = inputCol.parent();
                let inputSet    = inputRow.parent();
                let nodeName    = inputNode.attr('name');
                let labelName   = inputRow.attr('name');
                let labelNode   = $("#" + labelName);

                // flag the input element and it's wrappers as focussed
                inputSet.addClass("ffq-focus");
                inputRow.addClass("ffq-focus");
                inputCol.addClass("ffq-focus");

                // flag the label element and it's wrappers as focussed
                labelNode.addClass("ffq-focus");
                labelNode.parent().addClass("ffq-focus");
                labelNode.find( "div.freeform-question[for='" + nodeName + "']" ).addClass("ffq-focus");

                // setup internal properties for monitoring input for changes
                let currentVal    = inputNode.val();
                self.lastVal      = currentVal;
                self.prevVal      = currentVal;
                self.currentInput = inputNode;
                self.currentLabel = labelNode;

                // if there's a focus callback setup then call it
                if (focusCallback) {
                    focusCallback(nodeName);
                }
            });

            // hook a blur event handler to manage lowlighting of labels corresponding to input fields
            inputNodes.blur(function(e) {
                // if we have any left over input changes then apply them to the current label
                self.update_current_label(null);

                // unset the ffq-focus css class from the label node
                $('.ffq-focus').removeClass("ffq-focus");

                // clear the current node trackers used by the interval system (above)
                self.currentInput = null;
                self.currentLabel = null;
            });
        },

        update_current_label: function(updateCallback, feedback) {
            if (this.currentInput === null) {
                return;
            }

            if (typeof feedback == 'undefined') {
                feedback = '';
            }

            // if there's no change then give up
            let currentVal = this.currentInput.val();
            if (currentVal === this.prevVal) {
                return;
            }

            // clean the result assuming that it's an expression (if it turns out not tp be an expression we'll fix it afterwards)
            let cleanVal = expressionBeautifier.cleanExpressionText(currentVal);

            // store away the current answer in the answers vector used for question rendering
            let questionName = this.currentInput.attr('name');
            let uniqueId    = questionName.replace(/.*ffq_(\d*)_.*/,"$1");
            let questionIdx = questionName.replace(/.*_(\d+)$/,"$1");
            if (!(uniqueId in this.answers)) {
                this.answers[uniqueId] = [];
            }
            this.answers[uniqueId][questionIdx] = cleanVal;

            // bake the submitted value into its beautified form (protecting against html injection as we go)
            let bakedVal;
            let isExpression = this.currentLabel.hasClass("expression");
            let isFullExpression = this.currentLabel.hasClass("full-expression");
            if (isExpression) {
                let labelName = this.currentLabel.attr("for");
                let expressionId = labelName.replace(/.*_(\d+)$/,"$1");
                let expression = this.expressions[uniqueId][expressionId];
                bakedVal = expressionBeautifier.beautify("( " + expression + ")", this.answers[uniqueId]);
            } else if (isFullExpression) {
                bakedVal = expressionBeautifier.beautifyExpression(currentVal, false);
            } else {
                bakedVal = currentVal.replace(/&/g,"&amp").replace(/</g,"&lt");
                cleanVal = ":txt:" + bakedVal;
                this.answers[uniqueId][questionIdx] = cleanVal;
            }

            // if we have a callback to call then call it
            if (updateCallback){
                updateCallback({
                    answerText:     cleanVal,
                    questionName:   questionName,
                    questionIdx:    questionIdx,
                    tag:            this.currentInput,
                    uniqueId:       uniqueId,
                    answers:        this.answers[uniqueId]
                });
            }

            // revert to displaying a '?' if the user input is empty
            if (currentVal.length === 0){
                bakedVal = '?';
            }

            // update the label with the beautified version of the text that we just typed
            this.currentLabel.html(bakedVal + feedback);

            // update the focus markers
            this.currentLabel.find( "div.freeform-question[for='" + questionName + "']" ).addClass("ffq-focus");

            // remember the last text that we applied in order to avoid re-doing unnecessary work in the future
            this.prevVal = currentVal;
        },

        updateLabel : function(instanceName, feedback) {

            let holdInput   = this.currentInput;
            let holdLabel   = this.currentLabel;
            let holdLastVal = this.lastVal;
            let holdPrevVal = this.prevVal;

            this.currentInput    = $('input[name='+instanceName+']');
            let labelName        = this.currentInput.closest('.input-row').attr('name');
            this.currentLabel    = $('#'+labelName);
            this.lastVal         = null;
            this.prevVal         = null;

            this.update_current_label(null, feedback);

            this.currentInput    = holdInput;
            this.currentLabel    = holdLabel;
            this.lastVal         = holdLastVal;
            this.prevVal         = holdPrevVal;

        },

        setQuestionContextName : function(name, instanceId) {
            expressionBeautifier.setQuestionContextName(name, instanceId);
        }
    };

    // call the 'reset' method to initialise internal properties
    self.answers = [];
    self.expressions = [];
    self.reset();

    // return the 'self' object that we just constructed
    return self;
});
