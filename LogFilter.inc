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

/*
    if (drupal_session_started()
        && !empty($_SESSION['module']) && !empty($_SESSION['module']['log_filter']) && !empty($_SESSION['module']['log_filter']['filter'])) {
      $filter = $_SESSION['module']['log_filter']['filter'];
    }
    else {
      $filter = new stdClass();
      $filter->conditions = array();
      $filter->orderBy = array('timestamp' => 'DESC');
    }
    echo inspect_get($filter);
*/

    $nOptions_severity = count(
        $options_severity = array(
            0 => t('emergency'),
            1 => t('alert'),
            2 => t('critical'),
            3 => t('error'),
            4 => t('warning'),
            5 => t('notice'),
            6 => t('info'),
            7 => t('debug'),
        )
    );

    $form['filter'] = array(
        '#type' => 'fieldset',
        '#title' => t('Filter'),
        '#collapsible' => TRUE,
        '#collapsed' => FALSE,
        'log_filter_severity' => array(
            '#type' => 'select',
            '#title' => t('Severity'),
            '#multiple' => TRUE,
            '#size' => $nOptions_severity,
            '#options' => $options_severity,
            '#default_value' => array(2, 5),
            //'#access' => FALSE,
            '#required' => FALSE,
        ),
        'log_filter_severity_2' => array(
            '#type' => 'checkboxes',
            '#title' => t('Severity'),
            '#multiple' => TRUE,
            //'#size' => $nOptions_severity,
            '#options' => $options_severity,
            '#default_value' => array(2, 5),
            //'#access' => FALSE,
            '#required' => FALSE,
        ),
    );


    $form['actions'] = array(
        '#type' => 'actions',
        'submit' => array(
            '#type' => 'submit',
            '#value' => t('Update'),
        )
		);

    $form['#submit'][] = 'log_filter_form_submit';
    return $form;


    try {




      if (!$filter) {
        $filter = new stdClass();
        $filter->conditions = array();
        $filter->orderBy = array('timestamp' => 'DESC');
      }

      if (($nFiltered = $nTotal = db_select('watchdog')
					->countQuery()->execute()->fetchField())) {
        //  List of watch ids of logs; by filter.
        $ids = db_select('watchdog')
              ->fields('watchdog', array('wid'));
        if ($filter->conditions) {
          foreach ($filter->conditions as $k => $v) {
            $ids->condition($arr[0], $arr[1], $arr[2]); // 'field name', value, '='

            switch ($k) {
              case 'severity':
              case 'type':
                if (strlen($v)) {
                  $ids->condition($k, $v, 'IN');
                }
                break;
              case 'roles':
                if (strlen($v)) {
                  if(($uids = db_select('users_roles')
                      ->fields('uid')
                      ->condition('rid', $v, 'IN')
                      ->distinct()
                      ->execute()->fetchAll())) {
                    $ids->condition($k, join(',', $uids), 'IN');
                  }
                  else {
                    //  No user exists having any of the selected roles.
                    drupal_set_message('No user exists having any of the selected roles.', 'warning');
                    //  Make un-matchable condition, and get out.
                    $ids->condition($k, -1, '=');
                    break 2;
                  }
                }
                break;
              case 'time_from':
                $ids->condition($k, $v, '>=');
                break;
              case 'time_to':
                $ids->condition($k, $v, '<=');
                break;
              default:
                $ids->condition($k, $v, '=');
            }
          }
        }
        if (($nFiltered = count($ids = $ids->orderBy($filter->orderBy[0], $filter->orderBy[1])->execute()->fetchAll()))) {

          $logs = array();

          //  Fetch all matched cached logs.
          if(($cached = db_select('log_filter_cache'/*, null, array('fetch' => PDO::FETCH_OBJ)*/)
              ->fields('data')
              ->condition('wid', $ids, 'IN')
              ->distinct() // There may be dupes.
              ->execute()->fetchAllAssoc('wid'))) {
            $logs =& $cached;




          }
          //  Fetched all non-cached.
          if (count($logs) < $nFiltered) {




          }






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




    $filter = new stdClass();
    $filter->conditions = array();
    $filter->orderBy = array('timestamp' => 'was');

    if (module_exists('state')) {
      State::set('module', 'log_filter', 'filter', $filter);
    }
    else {
      drupal_session_start();
      if (!isset($_SESSION['module'])) {
        $_SESSION['module'] = array(
            'log_filter' => array(
                'filter' => $filter,
            ),
        );
      }
      elseif (!isset($_SESSION['module']['log_filter'])) {
        $_SESSION['module']['log_filter'] = array(
            'filter' => $filter,
        );
      }
      else {
        $_SESSION['module']['log_filter']['filter'] = $filter;
      }
    }

  }
}