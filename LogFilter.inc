<?php
/**
 * @file
 *  Drupal Log Filter module
 */

class LogFilter {

  /**
	 * @param Exception $xc
	 * @return void
	 */
	protected static function _errorHandler($xc) {
		if(!inspect_trace($xc, array('category'=>'log_filter', 'severity'=>WATCHDOG_ERROR))) {
			watchdog(
				'log_filter',
				$xc->getMessage(),
				NULL,
				WATCHDOG_ERROR
			);
		}
	}

  /**
	 * Defines log viewer form and GUI.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return array
	 */
  public static function form($form, &$form_state) {
    return $form;
  }

  /**
	 * Called when log viewer form submits.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return void
	 */
  public static function formSubmit($form, &$form_state) {
  }
}