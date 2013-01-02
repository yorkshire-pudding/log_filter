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
    $path = drupal_get_path('module', 'log_filter');

    drupal_add_library("system", "ui.datepicker");
    drupal_add_js(
        $path . '/js/jquery_ui_datepicker_i18n/jquery.ui.datepicker-' . $GLOBALS['language']->language . '.min.js',
        array('type' => 'file', 'group' => JS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
    );

    drupal_add_css(
        $path . '/css/log_filter.css',
        array('type' => 'file', 'group' => CSS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
    );
    drupal_add_js(
        $path . '/js/log_filter.js',
        array('type' => 'file', 'group' => JS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
    );


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









    try {


      $options_filters = array(
          '' => '',
          'apple' => 'apple',
          'pie' => 'pie',
          'bananas' => 'bananas',
      );


      $options_severity = array(
          '-1' => t('Any'),
          '0' => t('emergency'),
          '1' => t('alert'),
          '2' => t('critical'),
          '3' => t('error'),
          '4' => t('warning'),
          '5' => t('notice'),
          '6' => t('info'),
          '7' => t('debug'),
      );

      /* $options_type = array(
          'log_filter_type_wildcard' => t('Any type'),
      );*/
      if(($types = db_select('watchdog')
          ->fields('watchdog', array('type'))
          ->distinct()
          ->execute()->fetchCol())) {
        sort($types);
        /*foreach ($types as $v) {
          $options_type[ $v ] = $v;
        }*/
      }
      $options_type = join("\n", $types);

      $options_orderBy = array(
          '' => t('None'),
          'time' => t('Time'),
          'severity' => t('Severity'),
          'type' => t('Type'),
          'uid' => t('User ID'),
          'hostname' => t('User\'s host name'),
          'location' => t('Location'),
          'referer' => t('Referrer'),
      );


      $form['filter'] = array(
          '#type' => 'fieldset',
          '#title' => t('Filter') . ': <span id="log_filter_title_display">' . t('None') . '</span>',
          '#collapsible' => TRUE,
          '#collapsed' => FALSE,
          //  Time.
          'log_filter_time_range' => array(
              '#type' => 'textfield',
              '#title' => t('Last no. of hours'),
              //'#default_value' => array(2, 5),
              '#size' => 2,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div id="log_filter_criteria"><div class="filter-criteria"><div class="form-item log-filter-time">',
          ),
          'log_filter_time_from_display' => array(
              '#type' => 'textfield',
              '#title' => t('From date'),
              '#default_value' => '',
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-time-or">' . t('or') . '</div>',
          ),
          'log_filter_time_from' => array(
              '#type' => 'hidden',
              '#default_value' => 1257154695,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_time_to_display' => array(
              '#type' => 'textfield',
              '#title' => t('To date'),
              '#default_value' => '',
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-time-andor">' . t('and/or') . '</div>',
          ),
          'log_filter_time_to' => array(
              '#type' => 'hidden',
              //'#default_value' => 1257154695,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div>',
          ),
          //  Severity.
          'log_filter_severity' => array(
              '#type' => 'checkboxes',
              '#title' => t('Severity'),
              '#multiple' => TRUE,
              '#options' => $options_severity,
              //'#default_value' => array(2, 5),
              '#attributes' => array('autocomplete' => 'off'),
          ),
          //  Type.
          'log_filter_type_wildcard' => array(
              '#type' => 'checkbox',
              '#title' => t('Any'),
              //'#default_value' => array(2, 5),
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-type">'
                  . '<label>' . t('Type') . '</label>',
          ),
          'log_filter_type' => array(
              '#type' => 'textarea',
              '#default_value' => $options_type,
              '#rows' => 6,
              '#cols' => 48,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div>',
          ),
          //  Various.
          'log_filter_uid' => array(
              '#type' => 'textfield',
              '#title' => t('User ID'),
              //'#default_value' => array(2, 5),
              '#size' => 11,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-various">',
          ),
          'log_filter_hostname' => array(
              '#type' => 'textfield',
              '#title' => t('User\'s host name'),
              //'#default_value' => array(2, 5),
              '#size' => 32,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_location' => array(
              '#type' => 'textfield',
              '#title' => t('Location'),
              //'#default_value' => array(2, 5),
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_referer' => array(
              '#type' => 'textfield',
              '#title' => t('Referrer'),
              //'#default_value' => array(2, 5),
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div></div>',
          ),
          //  Order by.
          'log_filter_orderby_1' => array(
              '#type' => 'select',
              '#options' => $options_orderBy,
              //'#default_value' => array(2, 5),
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="filter-orderby"><label>' . t('Order by') . '</label>',
          ),
          'log_filter_descending_1' => array(
              '#type' => 'checkbox',
              //'#default_value' => array(2, 5),
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_orderby_2' => array(
              '#type' => 'select',
              '#options' => $options_orderBy,
              //'#default_value' => array(2, 5),
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_descending_2' => array(
              '#type' => 'checkbox',
              //'#default_value' => array(2, 5),
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_orderby_3' => array(
              '#type' => 'select',
              '#options' => $options_orderBy,
              //'#default_value' => array(2, 5),
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_descending_3' => array(
              '#type' => 'checkbox',
              //'#default_value' => array(2, 5),
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_reset' => array(
              '#type' => 'button',
              '#name' => 'log_filter_reset',
              '#value' => t('Reset'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit'),
                  //'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div></div>',
          ),
          //  Filters.
          'log_filter_filter' => array(
              '#type' => 'select',
              '#title' => t('Filter'),
              '#options' => $options_filters,
              //'#default_value' => array(2, 5),
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
              '#prefix' => '<div id="log_filter_filters">',
          ),
          'log_filter_create' => array(
              '#type' => 'button',
              '#name' => 'log_filter_create',
              '#value' => t('Create'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit'),
                  //'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_name' => array(
              '#type' => 'textfield',
              '#title' => t('Name'),
              //'#default_value' => array(2, 5),
              '#size' => 32,
              '#attributes' => array(
                  'maxlength' => 32,
                  'autocomplete' => 'off',
               ),
          ),
          'log_filter_description' => array(
              '#type' => 'textarea',
              '#title' => t('Description'),
              //'#default_value' => array(2, 5),
              '#rows' => 2,
              '#cols' => 32,
              '#resizable' => FALSE, // Otherwise styling too complicated, and browsers support it natively.
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
          ),
          'log_filter_copy' => array(
              '#type' => 'button',
              '#name' => 'log_filter_copy',
              '#value' => t('Copy'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit'),
                  //'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_edit' => array(
              '#type' => 'button',
              '#name' => 'log_filter_edit',
              '#value' => t('Edit'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit'),
                  //'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_delete' => array(
              '#type' => 'button',
              '#name' => 'log_filter_delete',
              '#value' => t('Delete'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit'),
                  //'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_save' => array(
              '#type' => 'button',
              '#name' => 'log_filter_save',
              '#value' => t('Save'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit'),
                  //'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div></div>',
          ),
      );

      $title_cache = t('Easier on performance, despite translated logs are being cached.');

      $form['log_filter_footer'] = array(
          'frontend_instantiation' => array(
              '#type' => 'markup',
              '#markup' => '<script type="text/javascript">
(function($) {
  if(!$) {
    return;
  }
  $(document).bind("ready", function() {

    $("div.form-item-log-filter-cache label").get(0).setAttribute("title", "' . str_replace(array("\n", "\r", '"'), '', $title_cache) . '");

    LogFilter.init();
  } );
})(jQuery);
</script>
',
          ),
          'actions' => array(
              '#type' => 'actions',
              'submit' => array(
                  '#type' => 'submit',
                  '#value' => t('Update'),
              ),
          ),
          'footer_fields' => array(
              '#prefix' => '<div id="log_filter_footer_fields">',
              '#suffix' => '</div>',
              'log_filter_pager_range' => array(
                '#type' => 'textfield',
                '#title' => t('Logs per page'),
                '#default_value' => 100,
                '#attributes' => array('autocomplete' => 'off'),
                '#size' => 4,
              ),
              'log_filter_pager_controls' => array(
                '#type' => 'markup',
                '#markup' => '<div class="log-filter-pager-controls">pager</div>',
              ),
              //  Translate and cache messages.
              'log_filter_cache' => array(
                  '#type' => 'checkbox',
                  '#title' => t('Don\'t translate messages'),
                  '#default_value' => FALSE,
                  '#attributes' => array(
                      'autocomplete' => 'off',
                      'title' => $title_cache,
                  ),
              ),
          ),
          '#prefix' => '<span id="log_filter_footer">',
          '#suffix' => '</span>',
      );







      /*$form['actions'] = array(
          '#type' => 'actions',
          'submit' => array(
              '#type' => 'submit',
              '#value' => t('Update'),
          ),
          '#prefix' => '<div class="whatever">',
          '#suffix' => '</div>',
      );*/

      $form['#submit'][] = 'log_filter_form_submit';
      return $form;


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


    //inspect($form_state['values']);


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