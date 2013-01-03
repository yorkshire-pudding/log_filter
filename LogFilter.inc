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
          'filter', // Select.
          'name', // Hidden.
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
          'uid',
          'hostname',
          'location',
          'referer',
      ),
      'orderBy' => array(
          'orderby_',
          'descending_',
      ),
  );


  protected static function _prepareCriteria(&$conditions, &$orderBy, $submitted = FALSE) {
    $fields =& self::$_fields['conditions'];
    $conds = array();
    foreach ($fields as $name) {
      switch ($name) {
        case 'severity': // For IN.
          if (($v = $conditions['severity'])) {
            if (!$submitted) { // Comma-separated list.
              $conds['severity'] = $v;
            }
            else { // Array.
              $conds['severity'] = join(',', $v);
            }
          }
          break;
        case 'type': // Newline-separated list, for IN.
          if (($v = $conditions['type'])
              && (!!$submitted || !$conditions['type_wildcard'])
          ) {
            $conds['type'] = "'" . str_replace("\n", "','", $v) . "'";
          }
          break;
        case 'time_range':
        case 'time_from':
        case 'time_to':
        case 'uid':
        case 'hostname':
        case 'referer':
          if (($v = $conditions[$name])) {
            $conds[$name] = $v;
          }
          break;
        case 'time_from_display':
        case 'time_to_display':
        case 'type_wildcard':
          //  Skip these; and they BTW only exist when submitted.
          break;
        default:
          throw new Exception('Unsupported condition field[' . $name . '].');
      }
    }
    return array(
        'conditions' => $conds,
    );
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



      //  Flag if form vars should be used at all.
      $use_submitted = $submitted && !$submitted['reset'];

      //$use_filter =

      //  Prepare some fields.
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

      //  Types.
      if ($use_submitted && ($v = $submitted['conditions']['type'])) {
        $values_type = $v;
      }
      elseif (($types = db_select('watchdog')
          ->fields('watchdog', array('type'))
          ->distinct()
          ->execute()->fetchCol())) {
        sort($types);
      }
      $values_type = join("\n", $types);

      //  Order by.
      $options_orderBy = array(
          '' => '',
          'time' => t('Time'),
          'severity' => t('Severity'),
          'type' => t('Type'),
          'uid' => t('User ID'),
          'hostname' => t('Visitor\'s hostname'),
          'location' => t('Location'),
          'referer' => t('Referrer'),
      );
      $values_orderBy = array();
      if ($use_submitted && ($arr = $submitted['orderBy'])) {
        foreach ($arr as $k => $v) {
          $values_orderBy[] = array($k, $v == 'DESC');
        }
      }

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
          '#title' => t('Filter') . ': <span id="log_filter_title_display">' . t('None') . '</span>',
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
              '#default_value' => !$use_submitted ? '' : $submitted['filter']['origin'],
          ),
          //  Conditions.
          //  Time.
          'log_filter_time_range' => array(
              '#type' => 'textfield',
              '#title' => t('Last no. of hours'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['time_range'],
              '#size' => 2,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div id="log_filter_criteria"><div class="filter-conditions"><div class="form-item log-filter-time">',
          ),
          'log_filter_time_from_display' => array(
              '#type' => 'textfield',
              '#title' => t('From date'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['time_from_display'],
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-time-or">' . t('or') . '</div>',
          ),
          'log_filter_time_from' => array(
              '#type' => 'hidden',
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['time_from'],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_time_to_display' => array(
              '#type' => 'textfield',
              '#title' => t('To date'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['time_to_display'],
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-time-andor">' . t('and/or') . '</div>',
          ),
          'log_filter_time_to' => array(
              '#type' => 'hidden',
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['time_to'],
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div>',
          ),
          //  Severity.
          'log_filter_severity' => array(
              '#type' => 'checkboxes',
              '#title' => t('Severity'),
              '#multiple' => TRUE,
              '#options' => $options_severity,
              '#default_value' => !$use_submitted ? array('-1') : // Any.
                  $submitted['conditions']['severity'],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          //  Type.
          'log_filter_type_wildcard' => array(
              '#type' => 'checkbox',
              '#title' => t('Any'),
              '#default_value' => !$use_submitted ? TRUE : $submitted['conditions']['type_wildcard'],
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-type">'
                  . '<label>' . t('Type') . '</label>',
          ),
          'log_filter_type' => array(
              '#type' => 'textarea',
              '#default_value' => $values_type,
              '#rows' => 6,
              '#cols' => 48,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div>',
          ),
          //  Various.
          'log_filter_uid' => array(
              '#type' => 'textfield',
              '#title' => t('User ID'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['uid'],
              '#size' => 11,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-various">',
          ),
          'log_filter_hostname' => array(
              '#type' => 'textfield',
              '#title' => t('Visitor\'s hostname'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['hostname'],
              '#size' => 32,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_location' => array(
              '#type' => 'textfield',
              '#title' => t('Location'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['location'],
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_referer' => array(
              '#type' => 'textfield',
              '#title' => t('Referrer'),
              '#default_value' => !$use_submitted ? '' : $submitted['conditions']['referer'],
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div></div>',
          ),
          //  Order by.
          'log_filter_orderby_1' => array(
              '#type' => 'select',
              '#options' => $options_orderBy,
              '#default_value' => !$values_orderBy ? array('') : $values_orderBy[0][0],
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="filter-orderby"><label>' . t('Order by') . '</label>',
          ),
          'log_filter_descending_1' => array(
              '#type' => 'checkbox',
              '#default_value' => !$values_orderBy ? FALSE : $values_orderBy[0][1],
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_orderby_2' => array(
              '#type' => 'select',
              '#options' => $options_orderBy,
              '#default_value' => !$values_orderBy || !isset($values_orderBy[1]) ? array('') : $values_orderBy[1][0],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_descending_2' => array(
              '#type' => 'checkbox',
              '#default_value' => !$values_orderBy || !isset($values_orderBy[1]) ? FALSE : $values_orderBy[1][1],
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => t('Descending'),
              ),
          ),
          'log_filter_orderby_3' => array(
              '#type' => 'select',
              '#options' => $options_orderBy,
              '#default_value' => !$values_orderBy || !isset($values_orderBy[2]) ? array('') : $values_orderBy[2][0],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_descending_3' => array(
              '#type' => 'checkbox',
              '#default_value' => !$values_orderBy || !isset($values_orderBy[2]) ? FALSE : $values_orderBy[2][1],
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
              //'#default_value' => array(2, 5),
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
              '#suffix' => '</div>',
          ),
          'log_filter_delete_by_filter' => array(
              '#type' => 'button',
              '#name' => 'log_filter_delete_by_filter',
              '#value' => t('Delete matching logs'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'edit-delete', 'theme-' . $theme),
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

    $arr = db_select('watchdog', null, array('fetch' => PDO::FETCH_OBJ))
				->fields('watchdog', array('wid'))
        ->orderBy('timestamp', 'DESC')
        ->range(1, 10)
				->execute();
  }

  /**
	 * Called when log viewer form submits.
	 *
	 * @param array $form
	 * @param array &$form_state
	 * @return void
	 */
  public static function formSubmit($form, &$form_state) {
    try {
      $allow_crud = user_access('log_filter edit filters');

      //inspect_log_message('submitted');

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
            throw new Exception('Mode[' . $submitted['mode'] . '], empty name[' . $filter_name . '].');
          }
          break;
        case 'create':
        case 'edit':
        case 'delete':
          //  Get name.
          if (!($submitted['filter']['name'] = $filter_name = $values[$prefix . 'name'])) {
            throw new Exception('Mode[' . $submitted['mode'] . '], empty name[' . $filter_name . '].');
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
                $submitted['filter']['origin'] = $values[$prefix . 'origin'];
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
            $submitted['mode'] = 'default';
            $submitted['reset'] = TRUE;
          }
          break;
        default:
          throw new Exception('Unsupported mode[' . $submitted['mode'] . '].');
      }

      //  Load values from form.
      if($load) {
        $fields_conditions =& self::$_fields['conditions'];
        $conditions = array();
        $orderBy = array();
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
              $conditions[$name] = !$conditions['time_from'] ? '' : $values[$prefix . $name];
              break;
            case 'time_to':
              $conditions[$name] = $conditions['time_range'] ? '' : (($v = trim($values[$prefix . $name])) ? $v : '');
              break;
            case 'time_to_display':
              $conditions[$name] = !$conditions['time_to'] ? '' : $values[$prefix . $name];
              break;
            case 'type_wildcard':
              $conditions[$name] = $values[$prefix . $name] ? TRUE : FALSE;
              break;
            case 'type':
              //  Dont remember type list (may  be very long), if wildcard on.
              $conditions[$name] = !$conditions['type_wildcard'] ?
                  str_replace(array("\r", ',', "'", '"'), '', trim($values[$prefix . $name])) : ''; // Frontend fixes more formatting issues.
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
              $conditions[$name] = $vals;
              break;
            default:
              $conditions[$name] = trim($values[$prefix . $name]);
          }
        }
        unset($fields_conditions);

        $fields_orderBy =& self::$_fields['orderBy'];
        for ($i = 1; $i < 10; $i++) {
          if (array_key_exists($key = $prefix . $fields_orderBy[0] . $i, $values)) {
            if (($key = $values[ $key ])) {
              $orderBy[ $key ] = $values[ $prefix . $fields_orderBy[1] . $i ] ? 'DESC' : 'ASC';
            }
          }
          else {
            break;
          }
        }
        $submitted['conditions'] =& $conditions;
        $submitted['orderBy'] =& $orderBy;
      }

      if ($save) {

        if ($save == 'edit') {

        }
        else { // create

        }

      }


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

}