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

defined('MOODLE_INTERNAL') || die();

class expression_normaliser
{
    static private $isstaticinit    = false;
    static private $rules           = null;
    static private $parseregex      = null;

    public function __construct()
    {
        if (self::$isstaticinit !== true){
            self::static_init();
            self::$isstaticinit = true;
        }
    }

    static private function static_init()
    {
        // parse rules
        self::$rules = [
            ['type' => 'error', 'regex' => '(\S*\d[,.]\d*[,.]\S*)'],  // badly formed number
            ['type' => 'id',    'regex' => '([A-Za-z][a-z]*[0-9]*)'], // identifier
            ['type' => 'num',   'regex' => '((?:\d*[,.])?\d+)'],      // number
            ['type' => '-',     'regex' => '(-)'],
            ['type' => '+',     'regex' => '(\+)'],
            ['type' => '*',     'regex' => '(\*)'],
            ['type' => '/',     'regex' => '(/)'],
            ['type' => '^',     'regex' => '(\^)'],
            ['type' => '(',     'regex' => '(\()'],
            ['type' => ')',     'regex' => '(\))'],
            ['type' => '=',     'regex' => '(<=)'],
            ['type' => '=',     'regex' => '(>=)'],
            ['type' => '=',     'regex' => '(==)'],
            ['type' => '=',     'regex' => '(~=)'],
            ['type' => '=',     'regex' => '(!=)'],
            ['type' => '=',     'regex' => '(/=)', 'txt' => '!='],    // define '/=' as an alias for '!='
            ['type' => '=',     'regex' => '(<>)', 'txt' => '!='],    // define '<>' as an alias for '!='
            ['type' => '=',     'regex' => '(=)'],
            ['type' => '=',     'regex' => '(~)'],
            ['type' => '=',     'regex' => '(~=)'],
            ['type' => '=',     'regex' => '(~~)'],
            ['type' => '=',     'regex' => '(=~)'],
        ];

        // generate the concatenated regex that corresponds to the parse tokens
        $ruleregex = implode('|', array_map(function ($rule) {
            return $rule['regex'];
        }, self::$rules));

        // define the regular expression with clauses for each of the key identifier types
        self::$parseregex =
            '$'
            . $ruleregex . '|'   // concatenated regex for explicit rules
            . '(\S)'             // anything else (error cases)
            . '$';

    }

    /**
     * Convert the input string into an array of tokens, each including a 'type' and a 'txt' field
     * Applies a certain number of rules such as adding implied '*' in expressions like 2AB
     *
     * @param string $txt
     * @return array
     */
    private function parse_input($txt)
    {
        // split the input text into an array (by regex match) of array of regex clause matched
        preg_match_all(self::$parseregex, $txt, $matches, PREG_SET_ORDER);

        // iterate over the matches that we have, converting them to token descriptions
        $tokens = [];
        foreach ($matches as $matcharray) {
            $txt        = $matcharray[0];           // the text that was matched
            $rulenum    = count($matcharray) - 2;   // the identifier of the rule that was matched

            // if we fell into the catch-all error case then just register the erro end step on
            if ($rulenum >= count(self::$rules)) {
                $tokens[] = (object)['type' => 'error', 'txt' => $txt];
                continue;
            }

            // lookup the rule that we matched
            $rule = self::$rules[$rulenum];

            // store away the corresponding token, using an explicit 'txt' alias if one is provided or defaulting to the matched text
            $tokens[] = (object)[
                'type' => $rule['type'],
                'txt' => isset($rule['txt']) ? $rule['txt'] : $txt,
            ];
        }

        return $tokens;
    }

    /**
     * Return enriched token set including original tokens along with implicit tokens added for good measure
     *
     * @param array $rawtokens
     * @return array
     */
    private function add_implicit_tokens(array $rawtokens)
    {
        // iterate over the matches that we have, converting them to token descriptions
        $tokens = [];
        $prevtoken = ''; // the previous token
        foreach ($rawtokens as $t) {
            // check the rule type for special rules such as addition of implied operators
            switch ($t->type) {
                case '-':
                    // for binary minus - insert implied binary plus, making the minus into a unary minus
                    if ($prevtoken === 'id' || $prevtoken === 'num' || $prevtoken === ')') {
                        $tokens[] = (object)['type' => '+', 'txt' => '+'];
                    }
                    break;
                // convert binary divide - into binary multiply and unary divide
                case '/':
                    $tokens[] = (object)['type' => '*', 'txt' => '*'];
                    break;

                // add implied '*' for identifiers
                case 'id':
                    if ($prevtoken === 'id' || $prevtoken === 'num') {
                        $tokens[] = (object)['type' => '*', 'txt' => '*'];
                    }
                    break;

                // add implied '*' for sub clauses
                case '(':
                    if ($prevtoken === 'id' || $prevtoken === 'num' || $prevtoken === ')') {
                        $tokens[] = (object)['type' => '*', 'txt' => '*'];
                    }
                    break;
            }
            $tokens[] = $t;
            $prevtoken = $t->type;
        }

        return $tokens;
    }

    /**
     * Convert the input token array into an expression tree
     *
     * @param array $tokens
     * @return object
     */
    private function build_expression_tree(array $tokens)
    {
        // setup a little lookup table for nary rule precedence
        $rulepriority = [];
        $rulepriority['+'] = 1;
        $rulepriority['*'] = 2;
        $rulepriority['^'] = 3;

        // start with a root node to avoid having to deal with boundary cases
        $rootnode = (object)['type' => 'root', 'txt' => '', 'children' => [], 'parent' => null];
        $node = $rootnode;

        // iterate over the elements, combining them into tokens as required
        $state = 'begin';
        $prevnode = $rootnode;
        foreach ($tokens as $t) {
            switch ($state) {

                // BEGIN case : looking for a value or a unary operator
                case 'begin':
                    switch ($t->type) {

                        // append values to current active node
                        case 'id':
                        case 'num':
                            $node->children[] = $t;
                            $state = 'end';
                            break;

                        // open a '(...)' sub-clause
                        case '(':
                            $newnode = (object)['type' => 'clause', 'txt' => '', 'children' => [], 'parent' => $node];
                            $node->children[] = $newnode;
                            $node = $newnode;
                            $state = 'begin';
                            break;

                        // open a unary operator sub-clause
                        case '-':
                        case '/':
                            $newnode = (object)['type' => $t->type, 'childslots' => 1, 'txt' => $t->txt, 'children' => [], 'parent' => $node];
                            $node->children[] = $newnode;
                            $node = $newnode;
                            $state = 'begin';
                            break;

                        // ignore unary plus operator
                        case '+':
                            break;

                        // process end of sub clause - which is ok in the () case but not otherwise
                        case ')':
                            // error case: adding too many ')'s OR ')' following a unary operator
                            if ($node->type !== 'clause') {
                                $node->children[] = (object)['type' => 'error', 'txt' => ')'];
                                break;
                            }
                            // error case: we're expecting a value of some kind
                            if (!empty($node->children)) {
                                $node->children[] = (object)['type' => 'error', 'txt' => '...'];
                                break;
                            }
                            // close the current clause
                            $node = $node->parent;
                            $state = 'end';
                            break;

                        // anything else is an error case
                        default:
                            $node->children[] = (object)['type' => 'error', 'txt' => $t->txt];
                    }
                    break;

                // END case : looking for a binary operator, an end brace, etc
                case 'end':

                    switch ($t->type) {

                        // deal with end of sub clause - which is of in the () case but not otherwise
                        case ')':
                            // error case: miss-matched ')'
                            if ($node->type !== 'clause') {
                                $node->children[] = (object)['type' => 'error', 'txt' => ')'];
                                break;
                            }
                            // close the current clause
                            $node = $node->parent;
                            break;

                        // deal with compare operator - which is fine as long as this is the root node
                        case '=':
                            $node->children[] = $t;
                            $state = 'begin';
                            break;

                        // deal with binary operators
                        case '+':
                        case '*':
                        case '^':
                            $state = 'begin';
                            $node = $prevnode;

                            // deal with operator precedence
                            $prio = $rulepriority[$t->type];
                            while (isset($rulepriority[$node->type]) && ($rulepriority[$node->type] > $prio)) {
                                $node = $node->parent;
                            }

                            // identify the element that we're linking to
                            $idx        = count($node->children) - 1;
                            $lastchild  = &$node->children[$idx];

                            // link to the identified element
                            $newnode    = (object)['type' => $t->type, 'childslots' => 2, 'txt' => $t->txt, 'children' => [$lastchild], 'parent' => $node];
                            $lastchild  = $newnode;
                            $node       = $newnode;
                            break;

                        default:
                            $node->children[] = (object)['type' => 'error', 'txt' => $t->txt];
                            break;
                    }
                    break;
            }

            // store reference to the node that we just added a child to after closing down any fulfilled unary operators
            while (isset($node->childslots) && $node->childslots === 1 && count($node->children) == 1) {
                $node = $node->parent;
            }
            $prevnode = $node;

            // close down any n-ary operator clauses that have now been fulfilled
            while (isset($node->childslots) && $node->childslots === count($node->children)) {
                $node = $node->parent;
            }
        }

        // if we haven't closed all of our brackets then add an error token
        if ($node->type !== 'root') {
            $node->children[] = (object)['type' => 'error', 'txt' => '...'];
        }

        // prune out redundant sub_clause nodes
        $this->clean_expression_tree($rootnode);

        return $rootnode;
    }

    /**
     * Provide simple tree cleanup, eliminating nodes that aren't required
     *
     * @param $node
     */
    private function clean_expression_tree(&$node)
    {
        // if there are any children then clean them up
        if (isset($node->children)) {
            $cleanchildren = [];
            foreach ($node->children as &$child) {
                // recurse into child
                $this->clean_expression_tree($child);
                // eliminate + 0 clauses
                if (($node->type === '+') && ($child->type === 'num') && ($child->txt === '0')) {
                    continue;
                }
                // eliminate * 1 clauses
                if (($node->type === '*') && ($child->type === 'num') && ($child->txt === '1')) {
                    continue;
                }
                // for n-ary operators merge sub-trees of the same types
                if (($node->type === '*' || $node->type === '+') && ($child->type === $node->type)) {
                    $cleanchildren = array_merge($cleanchildren, $child->children);
                    continue;
                }
                // store away the child in the clean children vector
                $cleanchildren[] = $child;
            }
            $node->children = $cleanchildren;
        }

        // if we're a unary minus with a single unary minus child then eliminate both of us
        if ($node->type === '-' && count($node->children) === 1 && $node->children[0]->type === '-') {
            $node->type = 'clause';
            $node->txt = '';
            $node->children = $node->children[0]->children;
        }

        // eliminate ^ 1 clauses
        if ($node->type === '^' && count($node->children) === 2 && $node->children[1]->type === 'num' && $node->children[1]->txt === '1') {
            $node = $node->children[0];
        }

        // if we're a clause or + or * with a single child then replace ourselves with our child
        if (($node->type === 'clause' || $node->type === '+' || $node->type === '*') && count($node->children) === 1) {
            $node = $node->children[0];
        }
    }

    /**
     * @param $node
     * @return string
     */
    private function generate_tree_signature($node)
    {
        // if the node has no children then just return it's text
        if (!isset($node->children)) {
            return $node->txt;
        }
        // recurse into children, appending results to 'parts' array
        $parts = [];
        foreach ($node->children as $child) {
            $parts[] = $this->generate_tree_signature($child);
        }

        // for '*' and '+' cases sort the 'parts' array to make the signature unique for equivalent expressions
        if ($node->type === '+' || $node->type === '*') {
            asort($parts);
        }

        // assemble the parts into a result string along witht he node text
        $prefix = ($node->type === 'root') ? '' : '(' . $node->txt;
        $suffix = ($node->type === 'root') ? '' : ')';
        return $prefix . implode(' ', $parts) . $suffix;
    }

    /**
     * debug routine: dumps the tree structure to a string
     *
     * @param $node
     * @return string
     */
    private function dump_tree($node)
    {
        if (!isset($node->children)) {
            return $node->txt;
        }
        $parts = [];
        foreach ($node->children as $child) {
            $parts[] = $this->dump_tree($child);
        }
        $prefix = ($node->type === 'root') ? '[' : '(' . $node->txt . ' ';
        $suffix = ($node->type === 'root') ? ']' : ')';
        return $prefix . implode(' ', $parts) . $suffix;
    }

    public function normalise_expression($inputStr){
        // if this is explicitly a text string then just return it directly, no need for fancy treatment
        if (substr($inputStr,0,5) === ':txt:'){
            $cleanStr = preg_replace('/(\d+|\w+|\S)/', ' \1',' ' . substr($inputStr,5) . ' ');
            $cleanStr = preg_replace('/\s\s+/', ' ', $cleanStr);
            return $cleanStr;
        }

        $rawtokens  = $this->parse_input($inputStr);
        $tokens     = $this->add_implicit_tokens($rawtokens);
        $tree       = $this->build_expression_tree($tokens);
        $signature  = $this->generate_tree_signature($tree);
        return $signature;
    }
}
