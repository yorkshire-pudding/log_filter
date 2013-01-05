<?php
/**
 * @file
 *  Drupal Log Filter module
 */

class LogFilter {

  /**
   * @type integer
   */
  const PAGER_RANGE_DEFAULT = 100;

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
	 * @type array
	 */
	protected static $_fields = array(
      'settings' => array(
          'only_own',
          'cache',
          'pager_range',
      ),
      'filter' => array(
          'name', // Hidden.
          'origin',
          'name_suggest',
          'description',
      ),
      'conditions' => array(
          'time_range',
          'time_from',
          'time_from_display', // Skip in actual conditions.
          'time_to',
          'time_to_display', // Skip in actual conditions.
          'severity',
          'type_wildcard', // Skip in actual conditions.
          'type',
          'uid', // Default in database: -1.
          'hostname',
          'location',
          'referer',
      ),
      'order_by' => array(
          'orderby_',
          'descending_',
      ),
  );

  /**
	 * Defines log viewer form and GUI.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return array
	 */
  public static function viewerForm($form, &$form_state) {
    $path = drupal_get_path('module', 'log_filter');
    //  Get jQuery UI datepicker.
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

    try {
      //  Get submitted vars from session, and remove them (for later form build and submission).
      $session = $settings = $submitted = NULL;
      if (($module_state = module_exists('state'))) {
        if (($session = State::get('module', 'log_filter')) && array_key_exists('submitted', $session)) {
          $submitted = State::remove('module', 'log_filter', 'submitted');
        }
      }
      else {
        drupal_session_start();
        if (!empty($_SESSION['module']) && !empty($_SESSION['module']['log_filter'])) {
          $session = $_SESSION['module']['log_filter'];
          unset($_SESSION['module']['log_filter']['submitted']);
        }
      }
      if ($session) {
        if (array_key_exists('settings', $session)) {
          $settings =& $session['settings'];
        }
        if (array_key_exists('submitted', $session)) {
          $submitted =& $session['submitted'];
        }
      }

      //  Get current filter name, if any.
      $filter_name = $submitted ? $submitted['filter']['name'] : '';

      //  Get mode; default | adhoc | stored | create | edit | delete.
      $mode = $submitted ? $submitted['mode'] : 'default';

      //  Stored mode may degrade to default.
      if ($mode == 'stored') {
        $success = TRUE;
        if (!$filter_name) {
          throw new Exception('Filter name[' . $filter_name . '] cannot be empty in mode[stored].');
        }
        if (!($stored_filter = db_select('log_filter')
            ->fields('log_filter')
            ->condition('name', $filter_name, '=')
            ->execute()->fetchAssoc())
        ) {
          $success = FALSE;
          drupal_set_message(
              t('The filter \'!name\' doesn\'t exist.', array('!name' => $filter_name)),
              'warning'
          );
        }
        elseif ($stored_filter['require_admin'] && !user_access('log_filter administer')) {
          $success = FALSE;
        }
        if ($success) {
          $filter = array(
              'origin' => '',
              'description' => $stored_filter['description'],
          );
          $fields_conditions =& self::$_fields['conditions'];
          $conditions = array();
          foreach ($fields_conditions as $name) {
            switch ($name) {
              case 'time_range':
              case 'time_from':
              case 'time_to':
              case 'uid':
                $conditions[$name] = ($v = $stored_filter[$name]) > 0 ? $v : '';
                break;
              case 'severity':
                if (!strlen($v = $stored_filter['severity'])) {
                  $v = array('-1');
                }
                else {
                  $v = str_replace(',0,', ',zero,', ',' . $v . ',');
                  $v = explode(',', substr($v, 1, strlen($v) - 1));
                }
                $conditions['severity'] = $v;
                break;
              case 'type_wildcard':
                $conditions['type_wildcard'] = !$stored_filter['type'] ? TRUE : FALSE;
                break;
              case 'type':
                $conditions['type'] = ($v = $stored_filter['type']) ? $v : ''; // db text field; safeguard against null value (despite schema declaration).
                break;
              case 'time_from_display':
              case 'time_to_display':
                //  Set by frontend, if non-empty time_from/time_to
                $conditions[$name] = '';
                break;
              default:
                $conditions[$name] = $stored_filter[$name];
            }
          }
          unset($fields_conditions);
          $order_by = array();
          if (($v = $stored_filter['order_by'])) {
            $le = count($arr = explode(',', $v));
            for ($i = 0; $i < $le; $i++) {
              $v = explode(':', $arr[$i]);
              $order_by[] = array($v[0], $v[1] == 'DESC');
            }
          }
          $title = $filter_name . (($v = $filter['description']) ? (' - ' . $v) : '');
        }
        else {
          $mode = 'default';
        }
        unset($stored_filter);
      }
      //  Do other modes.
      switch ($mode) {
        case 'default':
          $filter = array(
              'origin' => '',
              'description' => '',
          );
          $fields_conditions =& self::$_fields['conditions'];
          $conditions = array();
          foreach ($fields_conditions as $name) {
            switch ($name) {
              case 'severity':
                $conditions[$name] = array('-1');
                break;
              case 'type_wildcard':
                $conditions[$name] = TRUE;
                break;
              default:
                $conditions[$name] = '';
            }
          }
          unset($fields_conditions);
          $order_by = array(
              array('time', TRUE),
          );
          $title = t('Default');
          break;
        case 'adhoc':
          $filter =& $submitted['filter'];
          $conditions =& $submitted['conditions'];
          if (!$conditions['severity']) {
            $conditions['severity'] = array('-1');
          }
          $order_by =& $submitted['order_by'];
          $title = t('Ad hoc') . (($v = $filter['origin']) ? (' - ' . t('based on !origin', array('!origin' => $v))) : '');
          break;
        case 'stored':
          //  Done earlier.
          break;
        case 'create':
        case 'edit':
        case 'delete':
          throw new Exception('Mode[' . $mode . '] not allowed at form build.');
          break;
        default:
          throw new Exception('Unsupported mode[' . $mode . '].');
      }

      //  Prepare some fields.
      //  Types.
      if (!$conditions['type']) {
        if (($types = db_select('watchdog')
            ->fields('watchdog', array('type'))
            ->distinct()
            ->execute()->fetchCol())) {
          sort($types);
          $conditions['type'] = join("\n", $types);
        }
      }
      //  Severity.
      $options_severity = array(
          '-1' => t('Any'),
          'zero' => t('emergency'),
          '1' => t('alert'),
          '2' => t('critical'),
          '3' => t('error'),
          '4' => t('warning'),
          '5' => t('notice'),
          '6' => t('info'),
          '7' => t('debug'),
      );
      //  Order by.
      $options_order_by = array(
          '' => '',
          'time' => t('Time'),
          'severity' => t('Severity'),
          'type' => t('Type'),
          'uid' => t('User ID'),
          'hostname' => t('Visitor\'s hostname'),
          'location' => t('Location'),
          'referer' => t('Referrer'),
      );
      $length_order_by = count($order_by);


      //  Only own filters.
      $value_only_own = $settings && array_key_exists('only_own', $settings) ? $settings['only_own'] : FALSE;

      //  Filter selector.
      $options_filters = db_select('log_filter')
          ->fields('log_filter', array('name'));
      if (!$value_only_own) {
        $options_filters->orderBy('creator', 'ASC');
      }
      else {
        $options_filters->condition('creator', $GLOBALS['user']->uid, '=');
      }
      if (($options_filters = $options_filters->orderBy('changed', 'DESC')->orderBy('name', 'ASC')
          ->execute()->fetchCol())) {
        $options_filters = array_merge(
            array('' => ''),
            array_combine($options_filters, $options_filters)
        );
      }
      else {
        $options_filters = array('' => '');
      }

      //  Get current theme.
      $theme = $GLOBALS['theme'];

      //  Build form.
      $form['filter'] = array(
          '#type' => 'fieldset',
          '#title' => t('Filter') . ': <span id="log_filter_title_display">' . $title . '</span>',
          '#collapsible' => TRUE,
          '#collapsed' => FALSE,
          //  Control vars.
          'log_filter_mode' => array(
              '#type' => 'hidden',
              '#default_value' => $mode,
          ),
          'log_filter_name' => array(
              '#type' => 'hidden',
              '#default_value' => $filter_name,
          ),
          'log_filter_origin' => array(
              '#type' => 'hidden',
              '#default_value' => $filter['origin'],
          ),
          //  Conditions.
          //  Time.
          'log_filter_time_range' => array(
              '#type' => 'textfield',
              '#title' => t('Last no. of hours'),
              '#default_value' => $conditions['time_range'],
              '#size' => 2,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div id="log_filter_criteria"><div class="filter-conditions"><div class="form-item log-filter-time">',
          ),
          'log_filter_time_from_display' => array(
              '#type' => 'textfield',
              '#title' => t('From date'),
              '#default_value' => '', // Frontend sets it, if non-empty time_from.
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-time-or">' . t('or') . '</div>',
          ),
          'log_filter_time_from' => array(
              '#type' => 'hidden',
              '#default_value' => $conditions['time_from'],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_time_to_display' => array(
              '#type' => 'textfield',
              '#title' => t('To date'),
              '#default_value' => '', // Frontend sets it, if non-empty time_to.
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-time-andor">' . t('and/or') . '</div>',
          ),
          'log_filter_time_to' => array(
              '#type' => 'hidden',
              '#default_value' => $conditions['time_to'],
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div>',
          ),
          //  Severity.
          'log_filter_severity' => array(
              '#type' => 'checkboxes',
              '#title' => t('Severity'),
              '#multiple' => TRUE,
              '#options' => $options_severity,
              '#default_value' => $conditions['severity'],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          //  Type.
          'log_filter_type_wildcard' => array(
              '#type' => 'checkbox',
              '#title' => t('Any'),
              '#default_value' => $conditions['type_wildcard'],
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-type">'
                  . '<label>' . t('Type') . '</label>',
          ),
          'log_filter_type' => array(
              '#type' => 'textarea',
              '#default_value' => $conditions['type'],
              '#rows' => 6,
              '#cols' => 48,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div>',
          ),
          //  Various.
          'log_filter_uid' => array(
              '#type' => 'textfield',
              '#title' => t('User ID'),
              '#default_value' => $conditions['uid'],
              '#size' => 11,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-various">',
          ),
          'log_filter_hostname' => array(
              '#type' => 'textfield',
              '#title' => t('Visitor\'s hostname'),
              '#default_value' => $conditions['hostname'],
              '#size' => 32,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_location' => array(
              '#type' => 'textfield',
              '#title' => t('Location'),
              '#default_value' => $conditions['location'],
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_referer' => array(
              '#type' => 'textfield',
              '#title' => t('Referrer'),
              '#default_value' => $conditions['referer'],
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div></div>',
          ),
          //  Order by.
          'log_filter_orderby_1' => array(
              '#type' => 'select',
              '#options' => $options_order_by,
              '#default_value' => $length_order_by ? array($order_by[0][0]) : array(),
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="filter-orderby"><label>' . t('Order by') . '</label>',
          ),
          'log_filter_descending_1' => array(
              '#type' => 'checkbox',
              '#default_value' => $length_order_by ? $order_by[0][1] : FALSE,
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_orderby_2' => array(
              '#type' => 'select',
              '#options' => $options_order_by,
              '#default_value' => $length_order_by > 1 ? array($order_by[1][0]) : array(),
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_descending_2' => array(
              '#type' => 'checkbox',
              '#default_value' => $length_order_by > 1 ? $order_by[1][1] : FALSE,
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_orderby_3' => array(
              '#type' => 'select',
              '#options' => $options_order_by,
              '#default_value' => $length_order_by > 2 ? array($order_by[2][0]) : array(),
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_descending_3' => array(
              '#type' => 'checkbox',
              '#default_value' => $length_order_by > 2 ? $order_by[2][1] : FALSE,
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
                  'class' => array('form-submit', 'edit-reset', 'theme-' . $theme),
              ),
              '#prefix' => '<div class="log-filter-reset">',
              '#suffix' => '</div></div></div>',
          ),
          //  Filters.
          'log_filter_filter' => array(
              '#type' => 'select',
              '#title' => t('Filter'),
              '#options' => $options_filters,
              '#default_value' => $filter_name,
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
              '#prefix' => '<div id="log_filter_filters">',
          ),
          'log_filter_only_own' => array(
              '#type' => 'checkbox',
              '#title' => t('List my filters only'),
              '#default_value' => $value_only_own,
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
          ),
          'log_filter_create' => array(
              '#type' => 'button',
              '#name' => 'log_filter_create',
              '#value' => t('Create filter'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_name_suggest' => array(
              '#type' => 'textfield',
              '#title' => t('Name'),
              '#default_value' => '', // Only used frontend.
              '#size' => 32,
              '#attributes' => array(
                  'maxlength' => 32,
                  'autocomplete' => 'off',
               ),
          ),
          'log_filter_description' => array(
              '#type' => 'textarea',
              '#title' => t('Description'),
              '#default_value' => $filter['description'],
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
              '#value' => t('Copy filter'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
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
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_delete' => array(
              '#type' => 'button',
              '#name' => 'log_filter_delete',
              '#value' => t('Delete filter'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'edit-delete', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div>',
          ),
          'log_filter_cancel' => array(
              '#type' => 'button',
              '#name' => 'log_filter_cancel',
              '#value' => t('Cancel'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div>',
              '#suffix' => '</div></div>',
          ),
          'log_filter_save' => array(
              '#type' => 'button',
              '#name' => 'log_filter_save',
              '#value' => t('Save filter'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
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
    //  Set hover title on cache checkboxs label.
    $("div.form-item-log-filter-cache label").get(0).setAttribute("title", "' . str_replace(array("\n", "\r", '"'), '', $title_cache) . '");
    //  Go.
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
                  '#default_value' => $settings && array_key_exists('cache', $settings) ? !$settings['cache'] : FALSE, // Reverse the value;
                  '#attributes' => array(
                      'autocomplete' => 'off',
                      'title' => $title_cache,
                  ),
              ),
          ),
          '#prefix' => '<span id="log_filter_footer">',
          '#suffix' => '</span>',
      );
      //  Add our submit form;
      $form['#submit'][] = 'log_filter_form_submit';
      return $form;


      if (!$filter) {
        $filter = new stdClass();
        $filter->conditions = array();
        $filter->order_by = array('timestamp' => 'DESC');
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
        if (($nFiltered = count($ids = $ids->orderBy($filter->order_by[0], $filter->order_by[1])->execute()->fetchAll()))) {

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
      return array();
    }
    /*
    $arr = db_select('watchdog', null, array('fetch' => PDO::FETCH_OBJ))
				->fields('watchdog', array('wid'))
        ->orderBy('timestamp', 'DESC')
        ->range(1, 10)
				->execute();
     */
  }

  /**
	 * Called when log viewer form submits.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return void
	 */
  public static function viewerFormSubmit($form, &$form_state) {
    try {
      //inspect($form_state['values']);
      $values =& $form_state['values'];
      $prefix = 'log_filter_';

      $settings = array(
          'only_own' => $values[$prefix . 'only_own'],
          'cache' => !$values[$prefix . 'cache'], // Reverse the value.
          'pager_range' => ($v = (int)$values[$prefix . 'pager_range']) > -1 ? $v : self::PAGER_RANGE_DEFAULT,
      );

      $submitted = array(
          'mode' => $values[$prefix . 'mode'],
          'reset' => FALSE,
          'filter' => array(
              'name' => '',
              'origin' => '',
              'name_suggest' => '',
              'description' => '',
          ),
      );

      $load = $save = FALSE;
      switch (($mode = $submitted['mode'])) {
        case 'default':
          //  Use default values.
          break;
        case 'adhoc':
          //  Get specs from form.
          $load = TRUE;
          $submitted['filter']['origin'] = $values[$prefix . 'origin']; // ~ Hidden field.
          break;
        case 'stored': // Saved filter.
          //  Just get filter name.
          if (!($submitted['filter']['name'] = $filter_name = $values[$prefix . 'name'])) {
            throw new Exception('Mode[' . $mode . '], empty name[' . $filter_name . '].');
          }
          break;
        case 'create':
        case 'edit':
        case 'delete':
          //  Get name.
          if (!($submitted['filter']['name'] = $filter_name = $values[$prefix . 'name'])) {
            throw new Exception('Mode[' . $mode . '], empty name[' . $filter_name . '].');
          }
          $success = TRUE;
          //  Check CRUD permission.
          if (!user_access('log_filter edit filters')) {
            $success = FALSE;
            //  Horrible; have to make almost exactly same message, because of shortcomings of the localization regime.
            switch ($mode) {
              case 'create':
                watchdog(
                    'log_filter',
                    'Won\'t create the filter \'!name\' because user !user doesn\'t have \'log_filter edit filters\' permission.',
                    array('!name' => $filter_name, '!user' => $GLOBALS['user']->name),
                    WATCHDOG_WARNING
                );
                drupal_set_message(
                    t('Cannot create the filter \'!name\', because you don\'t have permission to edit log filters.', array('!name' => $filter_name)),
                    'warning'
                );
                break;
              case 'edit':
                watchdog(
                    'log_filter',
                    'Won\'t edit the filter \'!name\' because user !user doesn\'t have \'log_filter edit filters\' permission.',
                    array('!name' => $filter_name, '!user' => $GLOBALS['user']->name),
                    WATCHDOG_WARNING
                );
                drupal_set_message(
                    t('Cannot edit the filter \'!name\', because you don\'t have permission to edit log filters.', array('!name' => $filter_name)),
                    'warning'
                );
                break;
              default: // delete
                watchdog(
                    'log_filter',
                    'Won\'t delete the filter \'!name\' because user !user doesn\'t have \'log_filter edit filters\' permission.',
                    array('!name' => $filter_name, '!user' => $GLOBALS['user']->name),
                    WATCHDOG_WARNING
                );
                drupal_set_message(
                    t('Cannot delete the filter \'!name\', because you don\'t have permission to edit log filters.', array('!name' => $filter_name)),
                    'warning'
                );
            }
          }

          if ($mode != 'create') {
            //  Check if exists, and get require_admin field.
            if (!($require_admin = db_select('log_filter')
                ->fields('log_filter', array('require_admin'))
                ->condition('name', $filter_name, '=')
                ->execute()->fetchField())
            ) {
              if ($require_admin === FALSE) { // Doesn't exist.
                $success = FALSE;
                drupal_set_message(
                    t('The filter \'!name\' doesn\'t exist.', array('!name' => $filter_name)),
                    'warning'
                );
              }
              //  else... the filter doesnt require admin permission.
            }
            elseif (!user_access('log_filter administer')) {
              $success = FALSE;
            }
          }

          if ($success) {
            switch ($mode) {
              case 'create':
                //  Get specs from form, and save to database.
                $load = TRUE;
                $save = 'insert';
                $submitted['filter']['name_suggest'] = $values[$prefix . 'name_suggest'];
                $submitted['filter']['description'] = $values[$prefix . 'description'];
                break;
              case 'edit':
                //  Get specs from form, and save to database.
                $load = TRUE;
                $save = 'update';
                $submitted['filter']['description'] = $values[$prefix . 'description'];
                break;
              default: // delete
                db_delete('log_filter')->condition('name', $filter_name, '=')->execute();
                watchdog(
                    'log_filter',
                    'User !user deleted the log filter \'!name\'.',
                    array('!name' => $filter_name, '!user' => $GLOBALS['user']->name),
                    WATCHDOG_INFO
                );
                drupal_set_message(
                    t('Deleted the filter \'!name\'.', array('!name' => $filter_name))
                );
            }
          }
          else {
            $load = $save = FALSE;
            //  Change mode.
            $submitted['mode'] = $mode = 'default';
            $submitted['reset'] = TRUE;
          }
          break;
        default:
          throw new Exception('Unsupported mode[' . $mode . '].');
      }

      //  Load values from form.
      if($load) {
        $fields_conditions =& self::$_fields['conditions'];
        $conditions = array();
        foreach ($fields_conditions as $name) {
          switch ($name) {
            case 'time_range':
            case 'uid':
              $conditions[$name] = ($v = trim($values[$prefix . $name])) ? $v : '';
              break;
            case 'time_from':
              $conditions[$name] = $conditions['time_range'] ? '' : (($v = trim($values[$prefix . $name])) ? $v : '');
              break;
            case 'time_from_display':
              if (!$save) {
                $conditions[$name] = !$conditions['time_from'] ? '' : $values[$prefix . $name];
              }
              break;
            case 'time_to':
              $conditions[$name] = $conditions['time_range'] ? '' : (($v = trim($values[$prefix . $name])) ? $v : '');
              break;
            case 'time_to_display':
              if (!$save) {
                $conditions[$name] = !$conditions['time_to'] ? '' : $values[$prefix . $name];
              }
              break;
            case 'severity':
              $arr = $values[$prefix . $name];
              $vals = array();
              foreach ($arr as $k => $v) {
                if($v) {
                  if('' . $k == '-1') {
                    $vals = array();
                    break;
                  }
                  else {
                    $vals[] = $k;
                  }
                }
              }
              if ($save) {
                $vals = str_replace('zero', '0', join(',', $vals));
              }
              $conditions[$name] = $vals;
              break;
            case 'type_wildcard':
              $conditions[$name] = $values[$prefix . $name] ? TRUE : FALSE;
              break;
            case 'type':
              //  Dont remember type list (may  be very long), if wildcard on.
              $conditions[$name] = !$conditions['type_wildcard'] ?
                  str_replace(array("\r", ',', "'", '"'), '', trim($values[$prefix . $name])) : ''; // Frontend fixes more formatting issues.
              if ($save) {
                unset($conditions['type_wildcard']);
              }
              break;
            default:
              $conditions[$name] = trim($values[$prefix . $name]);
          }
        }
        unset($fields_conditions);
        $submitted['conditions'] =& $conditions;

        $fields_order_by =& self::$_fields['order_by'];
        $order_by = array();
        for ($i = 1; $i < 10; $i++) {
          if (array_key_exists($key = $prefix . $fields_order_by[0] . $i, $values)) {
            if (($key = $values[ $key ])) {
              if (!$save) {
                $order_by[] = array($key, $values[ $prefix . $fields_order_by[1] . $i ]);
              }
              else {
                $order_by[] = $key . ':' . $values[ $prefix . $fields_order_by[1] . $i ] ? 'DESC' : 'ASC';
              }
            }
          }
          else {
            break;
          }
        }
        unset($fields_order_by);
        if (!$save) {
          $submitted['order_by'] =& $order_by;
        }
        else {
          $submitted['order_by'] = join(',', $order_by);
          unset($order_by);
        }
      }

      if ($save) {
        $success = TRUE;
        if ($save == 'edit') {

        }
        else { // create

          $submitted['filter']['name_suggest'] = '';
        }

        //  Change mode.
        if ($success) {
          $submitted['mode'] = $mode = 'stored';
        }
        else {
          $submitted['mode'] = $mode = 'default';
          $submitted['reset'] = TRUE;
        }
      }

      //  Clear conditions and order_by from vars to be passed to session, unless adhoc filter.
      if ($mode != 'adhoc') {
        unset( $submitted['conditions'], $submitted['order_by'] );
      }

      //  Pass to session.
      if (module_exists('state')) {
        State::set('module', 'log_filter', array('settings' => $settings, 'submitted' => $submitted));
      }
      else {
        drupal_session_start();
        if (!isset($_SESSION['module'])) {
          $_SESSION['module'] = array(
              'log_filter' => array('settings' => $settings, 'submitted' => $submitted),
          );
        }
        else {
          $_SESSION['module']['log_filter'] = array('settings' => $settings, 'submitted' => $submitted);
        }
      }
    }
    catch (Exception $xc) {
      self::_errorHandler($xc);
      drupal_set_message($xc->getMessage(), 'error');
    }
  }

  /**
	 * Defines log removal form and GUI.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return array
	 */
  public static function removerForm($form, &$form_state) {
    $path = drupal_get_path('module', 'log_filter');
    drupal_add_css(
        $path . '/css/log_filter.css',
        array('type' => 'file', 'group' => CSS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
    );

    try {
      $form = array();

      //  Add our submit form;
      $form['#submit'][] = 'log_filter_remove_form_submit';
      return $form;
    }
    catch (Exception $xc) {
      self::_errorHandler($xc);
      drupal_set_message($xc->getMessage(), 'error');
      return array();
    }
  }

  /**
	 * Called when log removal form submits.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return void
	 */
  public static function removerFormSubmit($form, &$form_state) {
    try {
      //inspect($form_state['values']);
      $values =& $form_state['values'];
      $prefix = 'log_filter_';
    }
    catch (Exception $xc) {
      self::_errorHandler($xc);
      drupal_set_message($xc->getMessage(), 'error');
    }
  }
}


/**
 * Defines log viewer form and GUI.
 *
 * Function name not underscore prefixed to prevent html form id starting with hyphen (unhealthy naming).
 *
 * @param array $form
 * @param array &$form_state
 * @return array
 */
function log_filter_form($form, &$form_state) {
	return LogFilter::viewerForm($form, $form_state);
}

/**
 * Called when log viewer form submits.
 *
 * @param array $form
 * @param array &$form_state
 * @return void
 */
function _log_filter_form_submit($form, &$form_state){
  LogFilter::viewerFormSubmit($form, $form_state);
}

/**
 * Defines log removal form and GUI.
 *
 * Function name not underscore prefixed to prevent html form id starting with hyphen (unhealthy naming).
 *
 * @param array $form
 * @param array &$form_state
 * @return array
 */
function log_filter_remove_form($form, &$form_state) {
	return LogFilter::removerForm($form, $form_state);
}

/**
 * Called when log removal form submits.
 *
 * @param array $form
 * @param array &$form_state
 * @return void
 */
function _log_filter_remove_form_submit($form, &$form_state){
  LogFilter::removerFormSubmit($form, $form_state);
}