<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Plugin version infos
 *
 * @package    local_freeform
 * @copyright  2018 Edunao SAS (contact@edunao.com)
 * @author     Sadge <daniel@edunao.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace local_freeform;

define('AJAX_SCRIPT', true);
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/classes/expression_normaliser.php';


//-----------------------------------------------------------------------------
// action: generate_signature

function generate_signature(){
    // lookup the two expressions that we are supposed to be comparing
    $e = \required_param('e', PARAM_TEXT);

    // normalise the two expressions
    $normaliser = new expression_normaliser();
    $sig = $normaliser->normalise_expression($e);

    // compose and return the result object
    return [
        "result"    => 1,
        "e"         => $e,
        "signature" => $sig,
    ];
}


//-----------------------------------------------------------------------------
// action: test_question_answer

function test_question_answer(){
    // lookup the two expressions that we are supposed to be comparing
    $q = \required_param('q', PARAM_TEXT);
    $a = \required_param('a', PARAM_TEXT);

    // normalise the two expressions
    $normaliser = new expression_normaliser();
    $sq = $normaliser->normalise_expression($q);
    $sa = $normaliser->normalise_expression($a);

    // compose and return the result object
    return [
        "result" => 1,
        "q" => $q,
        "a" => $a,
        "signatures" => [
            "q" => $sq,
            "a" => $sa,
        ]
    ];
}


//-----------------------------------------------------------------------------
// Action evaluator

function execute_action($action){
    // execute the requested action, returning the action's result
    switch( $action ){
        case 'generate_signature': return generate_signature();
        case 'test_question_answer': return test_question_answer();
    }

    // if no action was matched then return an error message
    return [
        'error' => "Unrecornised action: $action"
    ];
}


//-----------------------------------------------------------------------------
// Main Code Entry Point

// make sure that the user is logged in
// NOTE when AJAX_SCRIPT is defined and set to true require_login will throw an exception in all cases where login is not validated
// The exception is caught by an AJAX-friendly defaultr error handler that outputs a json object containing the "error" property (among others)
\require_login();

// execut the required action
$action = \required_param('action', PARAM_TEXT);
$result = execute_action($action);

// encode and output the result
echo \json_encode($result);
