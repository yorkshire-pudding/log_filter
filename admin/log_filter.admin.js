/**
 * @file
 *	Drupal Log Filter module
 */

/**
 * @constructor
 * @class
 * @singleton
 * @param {obj} $
 *	- jQuery
 */
var LogFilter_Admin = function($) {
	var self = this;

};
//	instantiate and run init at window onload
(function($) {
	if(!$) {
		return;
	}
	$(document).bind("ready", function() {
		(LogFilter_Admin = new LogFilter_Admin($)).init();
	} );
})(jQuery);
