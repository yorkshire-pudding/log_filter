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
		if(!inspect_trace($xc, array('category' => 'log_filter', 'severity' => WATCHDOG_ERROR))) {
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

    try {




      if (!$filter) {
        $filter = new stdClass();
        $filter->conditions = array();
        $filter->orderBy = array('timestamp' => 'DESC');
      }

      if (($nFiltered = $nTotal = db_select('watchdog')
					->countQuery()->execute()->fetchField())) {

        $ids = db_select('watchdog')
              ->fields('watchdog', array('wid'));
        if ($filter->conditions) {
          foreach ($filter->conditions as $arr) {
            $ids->condition($arr[0], $arr[1], $arr[2]); // 'field name', value, '='
          }
        }
        if (($nFiltered = count($ids = $ids->orderBy($filter->orderBy[0], $filter->orderBy[1])->execute()->fetchAll()))) {



          
        }




        if ($filter) {



        }


        $relationTypes = db_select(self::TABLE_REL, null, array('fetch' => PDO::FETCH_OBJ))
					->fields(
							self::TABLE_REL // *
						)
					->condition('delta', $delta, '=')
					->execute()->fetchAll();

      }




      if (!$filter) {
        $nFiltered = $nTotal;
      }
      else {
        $nFiltered = db_select('watchdog')
            //->condition($idField, $entityId, '=')
            //->condition($typeField, $excluded, 'IN')
            ->countQuery()->execute()->fetchField();
      }

      if (!$nFiltered) {
        //$list = t('No log(s) mach')
      }

    }
    catch (Exception $xc) {
      self::_errorHandler($xc);
      drupal_set_message($xc->getMessage(), 'error');
    }

    $arr = db_select('watchdog', null, array('fetch' => PDO::FETCH_OBJ))
				->fields('watchdog', array('wid'))
        ->orderBy('timestamp', 'DESC')
        ->range(1, 10)
				->execute();

    $form['whatever'] = array(
      '#type' => 'fieldset',
      '#title' => t('General settings'),
      '#collapsible' => FALSE,
      '#collapsed' => FALSE,
      'log_filter_trnct' => array(
          '#type' => 'textfield',
          '#title' => t('List view message truncation'),
          '#default_value' => variable_get('log_filter_trnct', 100),
          //'#access' => FALSE,
          '#required' => FALSE,
          '#size' => 3,
      ),
    );

    $form['#submit'][] = 'log_filter_form_submit';
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