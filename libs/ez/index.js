'use strict';

var { Select, Option } = require('./select'),
	{ Slider } = require('./slider'),
	{ Checkbox } = require('./checkbox'),
	{ Switch } = require('./switch'),
	{ Input } = require('./input'),
	{ Button } = require('./button');

customElements.define('ez-checkbox', Checkbox);
customElements.define('ez-select', Select);
customElements.define('ez-option', Option);
customElements.define('ez-slider', Slider);
customElements.define('ez-input', Input);
customElements.define('ez-switch', Switch);
customElements.define('ez-button', Button);

exports.Checkbox = Checkbox;
exports.Select = Select;
exports.Option = Option;
exports.Slider = Slider;
exports.Input = Input;
exports.Switch = Switch;
exports.Button = Button;