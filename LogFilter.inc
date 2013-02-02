<?php
/**
 * @file
 *  Drupal Log Filter module
 */

class LogFilter {

  /**
   * @type integer
   */
  const TYPE_SOME_MAX = 102400;

  /**
   * @type integer
   */
  const PAGER_RANGE_DEFAULT = 100;


  //  @todo: frontend set name must continue to save via AJAX, but it must send criteria (dont simply make a default filter).
  //  Name suggest must use ordinary save button, not that stupid 'set' button.
  //  But saving upon edit must be an ordinary page post request (primarily because much easier).



  /**
   * @type array
   */
  protected static $_fields = array(
      'settings' => array(
          'only_own',
          'delete_logs_max',
          'cache',
          'pager_range',
      ),
      'filter' => array(
          'name', // Hidden.
          'origin',
          'name_suggest',
          'description',
          'require_admin',
      ),
      'conditions' => array(
          'time_range',
          'time_from',
          'time_from_proxy', // Skip in actual conditions.
          'time_to',
          'time_to_proxy', // Skip in actual conditions.
          'severity',
          'type_wildcard', // Skip in actual conditions.
          'type',
          'role', // Default in database: -1.
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
    //  Get jQuery UI dialog - because gecko's confirm()-dialog isnt draggable :-(
    drupal_add_library("system", "ui.dialog");

    if (variable_get('log_filter_css', TRUE)) {
      drupal_add_css(
          $path . '/css/log_filter.css',
          array('type' => 'file', 'group' => CSS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
      );
    }
    drupal_add_js(
        $path . '/js/log_filter.js',
        array('type' => 'file', 'group' => JS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
    );

    try {
      $allow_filter_edit = user_access('log_filter edit filters');

      //  Get submitted vars from session, and remove them (for later form build and submission).
      $session = $settings = $submitted = NULL;
      if (module_exists('state')) {
        if (($session = State::sessionGet('module', 'log_filter')) && array_key_exists('submitted', $session)) {
          $submitted = State::sessionRemove('module', 'log_filter', 'submitted');
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
      $filter_name = $submitted ? $submitted['filter']['name'] :
          (!empty($GLOBALS['_GET']) && array_key_exists('log_filter', $_GET)
              && ($le = strlen($v = $_GET['log_filter'])) && $le <= 32 && preg_match('/^[a-z\d_]+$/', $v) ? $v : '');

      $require_admin = $submitted ? $submitted['filter']['require_admin'] : FALSE;
      $user_admin_permission = user_access('log_filter administer');

      //  Get mode; default | adhoc | stored | edit | delete_filter.
      $mode = $submitted ? $submitted['mode'] : ($filter_name ? 'stored' : 'default');

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
        elseif ($stored_filter['require_admin'] && !$user_admin_permission) {
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
              case 'role':
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
                $conditions['type'] = ($v = $stored_filter['type']) ? $v : array();
                break;
              case 'time_from_proxy':
              case 'time_to_proxy':
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
              'require_admin' => FALSE,
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
              case 'type':
                $conditions[$name] = array();
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
        case 'edit':
        case 'delete_filter':
          throw new Exception('Mode[' . $mode . '] not allowed at form build.');
          break;
        default:
          throw new Exception('Unsupported mode[' . $mode . '].');
      }

      //  Prepare some fields.
      //  Types.
      if (($options_type = db_select('watchdog')
          ->fields('watchdog', array('type'))
          ->distinct()
          ->execute()->fetchCol())) {
        sort($options_type);
        $options_type = array_combine($options_type, $options_type);
        //  The filter may contain types that do not exist currently.
        $prepend_types = array();
        if ($conditions['type']) {
          foreach ($conditions['type'] as $v) {
            if (!isset($options_type[$v])) {
              $prepend_types[$v] = $v;
            }
          }
          if ($prepend_types) {
            $options_type = array_merge($prepend_types, $options_type);
          }
        }
      }
      else if ($conditions['type']) {
        $options_type = $conditions['type'];
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
      //  Role.
      //  Put anonymous user and authenticated user roles at top.
      $options_role = user_roles();
      $anon_user = $options_role[DRUPAL_ANONYMOUS_RID];
      $auth_user = $options_role[DRUPAL_AUTHENTICATED_RID];
      unset( $options_role[DRUPAL_ANONYMOUS_RID], $options_role[DRUPAL_AUTHENTICATED_RID] );
      $options_role = array_merge(
          array(
              '' => t('Any'),
              DRUPAL_ANONYMOUS_RID => $anon_user,
              DRUPAL_AUTHENTICATED_RID => $auth_user,
          ),
          $options_role
      );
      //  Order by.
      $options_order_by = array(
          '' => '',
          'time' => t('Time'),
          'severity' => t('Severity'),
          'type' => t('Type'),
          'role' => t('User role'),
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
      if (($options_filters = $options_filters
          ->orderBy('changed', 'DESC')
          ->orderBy('name', 'ASC')
          ->execute()->fetchCol())) {
        $js_filters = '["' . join('","', $options_filters) . '"]';
        $options_filters = array_merge(
            array('' => t('Default')),
            array_combine($options_filters, $options_filters)
        );
      }
      else {
        $js_filters = '[]';
        $options_filters = array('' => t('Default'));
      }

      //  Get current theme.
      $theme = $GLOBALS['theme'];

      //  Build form.
      $form['log_filter_filter_edit'] = array(
          '#type' => 'fieldset',
          '#title' => t('Filter') . ': <span id="log_filter_title_display">' . $title . '</span>',
          '#collapsible' => TRUE,
          '#collapsed' => FALSE,
          'frontend_init' => array(
              '#type' => 'markup',
              '#markup' => '<script type="text/javascript"> LogFilter.init(); </script>',
          ),
          //  Control vars.
          'log_filter_mode' => array(
              '#type' => 'hidden',
              '#default_value' => $mode,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_name' => array(
              '#type' => 'hidden',
              '#default_value' => $filter_name,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_origin' => array(
              '#type' => 'hidden',
              '#default_value' => $filter['origin'],
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_delete_logs' => array(
              '#type' => 'hidden',
              '#default_value' => '',
              '#attributes' => array('autocomplete' => 'off'),
          ),
          //  Conditions.
          //  Time.
          'log_filter_time_range' => array( // (3 open)
              '#type' => 'textfield',
              '#title' => t('Preceding hours'),
              '#default_value' => $conditions['time_range'],
              '#size' => 2,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div id="log_filter_criteria"><div class="filter-conditions"><div class="form-item log-filter-time">'
                  . '<label>' . t('Time') . '</label>',
          ),
          'log_filter_time_from_proxy' => array(
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
          'log_filter_time_to_proxy' => array(
              '#type' => 'textfield',
              '#title' => t('To date'),
              '#default_value' => '', // Frontend sets it, if non-empty time_to.
              '#size' => 10,
              '#attributes' => array('autocomplete' => 'off'),
          ),
          'log_filter_time_to' => array( // End: log-filter-time (2 open).
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
          'log_filter_type_wildcard' => array( // (3 open).
              '#type' => 'checkbox',
              '#title' => t('Any'),
              '#default_value' => $conditions['type_wildcard'],
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-type">'
                  . '<label>' . t('Type') . '</label>',
          ),
          'log_filter_type' => array( // End: log-filter-type (2 open).
              '#type' => 'checkboxes',
              '#options' => $options_type,
              '#default_value' => $conditions['type'],
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-type-container">',
              '#suffix' => '</div></div>',
          ),
          //  Various.
          'log_filter_role' => array( // (4 open).
              '#type' => 'select',
              '#title' => t('User role'),
              '#options' => $options_role,
              '#default_value' => $conditions['role'],
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="form-item log-filter-various"><div class="log-filter-user">',
          ),
          'log_filter_uid' => array( // End: log-filter-user (3 open).
              '#type' => 'textfield',
              '#title' => t('User ID'),
              '#default_value' => $conditions['uid'],
              '#size' => 11,
              '#attributes' => array('autocomplete' => 'off'),
              '#prefix' => '<div class="log-filter-role-or">' . t('or') . '</div>',
              '#suffix' => '</div>',
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
          'log_filter_referer' => array( // End: filter-conditions, (1 open).
              '#type' => 'textfield',
              '#title' => t('Referrer'),
              '#default_value' => $conditions['referer'],
              '#size' => 64,
              '#attributes' => array('autocomplete' => 'off'),
              '#suffix' => '</div></div>',
          ),
          //  Order by.
          'log_filter_orderby_1' => array( // (2 open)
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
          'log_filter_reset' => array( // End: log-filter-reset, filter-orderby, log_filter_criteria (0 open).
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
          'log_filter_filter' => array( // (2 open)
              '#type' => 'select',
              '#title' => t('Filter'),
              '#options' => $options_filters,
              '#default_value' => $filter_name,
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
              '#prefix' => '<div id="log_filter_filters"><div id="log_filter_box_filter"><div id="log_filter_filters_cell_0">',
          ),
          'log_filter_only_own' => !$allow_filter_edit ? array() : array(
              '#type' => 'checkbox',
              '#title' => t('List my filters only'),
              '#default_value' => $value_only_own,
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
              '#suffix' => '</div>',
          ),
          'log_filter_name_suggest' => !$allow_filter_edit ? array() : // (2 open)
          array( // (2 open)
              '#type' => 'textfield',
              '#title' => t('Name'),
              '#default_value' => '', // Only used frontend.
              '#size' => 32,
              '#attributes' => array(
                  'maxlength' => 32,
                  'autocomplete' => 'off',
               ),
              '#prefix' => '<div id="log_filter_filters_cell_1">',
          ),
          'log_filter_require_admin' => !$allow_filter_edit || !$user_admin_permission ? array() : // (2 open)
          array( // (2 open)
              '#type' => 'checkbox',
              '#title' => t('Restrict access') . '<span>?</span>',
              '#default_value' => $require_admin,
              '#attributes' => array(
                  'autocomplete' => 'off',
               ),
              '#suffix' => '</div>',
          ),
          'log_filter_description' => !$allow_filter_edit ? array() : // (2 open)
          array( // (2 open)
              '#type' => 'textarea',
              '#title' => t('Description'),
              '#default_value' => $filter['description'],
              '#rows' => 3,
              '#cols' => 32,
              '#resizable' => FALSE, // Otherwise styling too complicated, and browsers support it natively.
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => ($title_require_admin = t('Require the \'Administer log filtering\' permission.')),
               ),
          ),
          'log_filter_edit' => !$allow_filter_edit ? array() : // (2 open)
          array( // (3 open)
              '#type' => 'button',
              '#name' => 'log_filter_edit',
              '#value' => t('Edit'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div class="log-filter-edit-create">',
          ),
          'log_filter_create' => !$allow_filter_edit ? array() : // (2 open)
          array( // (2 open)
              '#type' => 'button',
              '#name' => 'log_filter_create',
              '#value' => t('Save as...'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#suffix' => '</div>',
          ),
          'log_filter_cancel' => !$allow_filter_edit ? array() : // (2 open)
          array( // (3 open)
              '#type' => 'button',
              '#name' => 'log_filter_cancel',
              '#value' => t('Cancel'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'edit-cancel', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div class="log-filter-cancel-save'
                  . (strpos(strtolower(PHP_OS), 'win') === 0 ? ' log-filter-reversed-button-sequence' : '') . '">',
          ),
          'log_filter_save' => !$allow_filter_edit ? array( // End: log_filter_box_filter (1 open)
              '#type' => 'markup',
              '#markup' => '</div>',
          ) : array( // End: log_filter_box_filter (2 open)
              '#type' => 'button',
              '#name' => 'log_filter_save',
              '#value' => t('Save'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#suffix' => '</div>',
          ),
          'log_filter_delete' => !$allow_filter_edit ? array() : // (2 open)
          array( // (1 open)
              '#type' => 'button',
              '#name' => 'log_filter_delete',
              '#value' => t('Delete filter'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'edit-delete', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div class="log-filter-delete">',
              '#suffix' => '</div></div>',
          ),
          'log_filter_delete_logs_button' => !($allow_delete_logs = user_access('log_filter remove logs')) ? array( // (0 open)
              '#type' => 'markup',
              '#markup' => '<div id="log_filter_box_delete_logs" class="log-filter-delete-logs-none">&nbsp;</div></div>',
          ) :
          array( // (2 open)
              '#type' => 'button',
              '#name' => 'log_filter_delete_logs_button',
              '#value' => t('Delete logs'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'type' => 'button', // Doesnt work; still type:submit.
                  'class' => array('form-submit', 'edit-delete', 'theme-' . $theme),
                  'style' => 'display:none;',
              ),
              '#prefix' => '<div id="log_filter_box_delete_logs">',
          ),
          'log_filter_delete_logs_max' => !$allow_delete_logs ? array( // (0 open)
          ) :
          array( // (2 open)
              '#type' => 'textfield',
              '#name' => 'log_filter_delete_logs_max',
              '#title' => t('Max.'),
              '#default_value' => $settings['delete_logs_max'],
              '#size' => 7,
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'maxlength' => 11,
              ),
              '#suffix' => '</div></div>',
          ),
      );

      $title_cache = t('Easier on performance, despite translated logs are being cached.');

      $form['log_filter_list_controls'] = array(
          'frontend_setup' => array(
              '#type' => 'markup',
              '#markup' => '<script type="text/javascript">
(function($) {
  if(!$) {
    return;
  }
  $(document).bind("ready", function() {
    var elm;
    //  Set hover title on some field labels.
    $("div.form-item-log-filter-cache label").get(0).setAttribute("title", "' . str_replace(array("\n", "\r", '"'), '', $title_cache) . '");
    ' . (!$allow_filter_edit ? '' :
    ('if((elm = $("div.form-item-log-filter-require-admin label").get(0))) {
      elm.setAttribute("title", "' . str_replace(array("\n", "\r", '"'), '', $title_require_admin) . '");
    }')) . '
    //  Go.
    LogFilter.setup(
      ' . $js_filters . '
    );
  } );
})(jQuery);
</script>
',
          ),
          'log_filter_update_list' => array(
              '#type' => 'button',
              '#name' => 'log_filter_update_list',
              '#value' => t('Update list'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'class' => array('form-submit', 'theme-' . $theme),
              ),
              '#prefix' => '<div class="log-filter-button log-filter-update-list">',
              '#suffix' => '</div>',
          ),
          'log_filter_pager_controls' => array(
              '#type' => 'markup',
              '#markup' => '<div class="log-filter-pager-controls">pager</div>',
          ),
          'log_filter_pager_range' => array(
            '#type' => 'textfield',
            '#title' => t('Logs per page'),
            '#default_value' => 100,
            '#attributes' => array('autocomplete' => 'off'),
            '#size' => 4,
          ),
          'log_filter_cache' => array(
              '#type' => 'checkbox',
              '#title' => t('Don\'t translate messages') . '<span>?</span>',
              '#default_value' => $settings && array_key_exists('cache', $settings) ? !$settings['cache'] : FALSE, // Reverse the value;
              '#attributes' => array(
                  'autocomplete' => 'off',
                  'title' => $title_cache,
              ),
          ),
          'log_filter_update_list_right' => array(
              '#type' => 'button',
              '#name' => 'log_filter_update_list_right',
              '#value' => t('Update list'),
              '#button_type' => 'button', // Doesnt work; still type:submit.
              '#attributes' => array(
                  'class' => array('form-submit', 'theme-' . $theme),
              ),
              '#prefix' => '<div class="log-filter-button log-filter-update-list-right">',
              '#suffix' => '</div>',
          ),
          'actions' => array(
              '#type' => 'actions',
              'submit' => array(
                  '#type' => 'submit',
                  '#value' => t('Update list'),
                  '#attributes' => array('style' => 'display:none;'),
              ),
          ),
          '#prefix' => '<div id="log_filter_list_controls">',
          '#suffix' => '</div>',
      );
      //  Add our submit form;
      $form['#submit'][] = '_log_filter_form_submit';
      return $form;

      //  NOT FINISHED, NAD MUST be in other method.
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
                if ($v) {
                  $ids->condition($k, $v, 'IN');
                }
                break;
              case 'roles':
                if ($v) {
                  if (($uids = db_select('users_roles')
                      ->fields('uid')
                      ->condition('rid', $v, 'IN')
                      ->distinct()
                      ->execute()->fetchAll())) {
                    $ids->condition($k, join(',', $uids), 'IN');
                  }
                  else {
                    //  No user exists having any of the selected roles.
                    drupal_set_message(t('No user exists having any of the selected roles.'), 'warning');
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
          if (($cached = db_select('log_filter_cache'/*, null, array('fetch' => PDO::FETCH_OBJ)*/)
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
          'only_own' => !array_key_exists($prefix . 'only_own', $values) ? FALSE : $values[$prefix . 'only_own'],
          'delete_logs_max' => !array_key_exists($prefix . 'delete_logs_max', $values) ? '' : $values[$prefix . 'delete_logs_max'],
          'cache' => !$values[$prefix . 'cache'], // Reverse the value.
          'only_own' => !array_key_exists($prefix . 'only_own', $values) ? FALSE : $values[$prefix . 'only_own'],
          'pager_range' => ($v = (int)$values[$prefix . 'pager_range']) > -1 ? $v : self::PAGER_RANGE_DEFAULT,
      );

      $submitted = array(
          'mode' => $values[$prefix . 'mode'],
          'filter' => array(
              'name' => '',
              'origin' => '',
              'name_suggest' => '',
              'description' => '',
              'require_admin' => !array_key_exists($prefix . 'require_admin', $values) ? FALSE : $values[$prefix . 'require_admin'],
          ),
      );

      $use_form_values = $save = FALSE;
      switch (($mode = $submitted['mode'])) {
        case 'default':
          //  Use default values.
          break;
        case 'adhoc':
          //  Get specs from form.
          $use_form_values = TRUE;
          $submitted['filter']['origin'] = $values[$prefix . 'origin']; // ~ Hidden field.
          break;
        case 'stored': // Saved filter.
          //  Just get filter name; in stored mode we do absolutely nothing at submission but establishing the filter's name.
          //  Whether the filter require_admin and user has that permission will be checked at form build - no reason to check twice.
          if (!($submitted['filter']['name'] = $filter_name = $values[$prefix . 'name'])) {
            throw new Exception('Mode[' . $mode . '], empty name[' . $filter_name . '].');
          }
          break;
        case 'edit':
        case 'delete_filter':
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
          if ($success) {
            switch ($mode) {
              case 'edit':
                //  Get specs from form, and save to database.
                $use_form_values = TRUE;
                $save = TRUE;
                $submitted['filter']['description'] = $values[$prefix . 'description'];
                //  Change mode.
                $submitted['mode'] = $mode = 'stored';
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
                //  Change mode.
                $submitted['mode'] = $mode = 'default';
            }
          }
          else {
            $use_form_values = $save = FALSE;
            //  Change mode.
            $submitted['mode'] = $mode = 'default';
          }
          break;
        default:
          throw new Exception('Unsupported mode[' . $mode . '].');
      }

      //  Load values from form.
      if ($use_form_values) {
        $fields_conditions =& self::$_fields['conditions'];
        $conditions = array();
        foreach ($fields_conditions as $name) {
          switch ($name) {
            case 'time_range':
            case 'role':
            case 'uid':
              $conditions[$name] = ($v = trim($values[$prefix . $name])) ? $v : '';
              break;
            case 'time_from':
              $conditions[$name] = $conditions['time_range'] ? '' : (($v = trim($values[$prefix . $name])) ? $v : '');
              break;
            case 'time_from_proxy':
              if (!$save) {
                $conditions[$name] = !$conditions['time_from'] ? '' : $values[$prefix . $name];
              }
              break;
            case 'time_to':
              $conditions[$name] = $conditions['time_range'] ? '' : (($v = trim($values[$prefix . $name])) ? $v : '');
              break;
            case 'time_to_proxy':
              if (!$save) {
                $conditions[$name] = !$conditions['time_to'] ? '' : $values[$prefix . $name];
              }
              break;
            case 'severity':
              $arr = $values[$prefix . $name];
              $vals = array();
              foreach ($arr as $k => $v) {
                if ($v) {
                  if ('' . $k == '-1') {
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
              //  Dont remember type list (may be very long), if wildcard on.
              $conditions[$name] = !$conditions['type_wildcard'] ? $values[$prefix . $name] : array();
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

      if ($save) { // edit mode.
        $success = TRUE;

        inspect(array(
            'filter' => $submitted['filter'],
            'conditions' => $submitted['conditions'],
            'order_by' => $submitted['order_by'],
        ), 'save');


        //  Change mode.
        if ($success) {
          $submitted['mode'] = $mode = 'stored';
        }
        else {
          $submitted['mode'] = $mode = 'default';
        }
      }

      //  Clear conditions and order_by from vars to be passed to session, unless adhoc filter.
      if ($mode != 'adhoc') {
        unset( $submitted['conditions'], $submitted['order_by'] );
      }

      //  Pass to session.
      if (module_exists('state')) {
        State::sessionSet('module', 'log_filter', array('settings' => $settings, 'submitted' => $submitted));
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

  protected static function _listLogs() {
    //  @todo: order by time must always be combined with order by log id, otherwise the actual temporal order may get wrong.
  }

  /**
   * Access permission: 'access site reports'.
   *
   *  Expects (requires) POST vars on actions:
   *  - create: name, require_admin
   *
   * @see LogFilter::ajaxCallback
   * @param string $action
   * @return void
   *  - sends 403 header if the expected POST vars arent set or their sanitized values evaluates to empty
   */
  public static function ajaxCallback($action) {
    if (!user_access('access site reports')
        || !$action || !($le = strlen($action)) || $le > 32
    ) {
      header('HTTP/1.1 403 Forbidden');
      exit;
    }
    $oResp = new stdClass();
    $oResp->action = $action;
    $oResp->success = TRUE;
    $oResp->error_code = 0;
    $oResp->error = '';

    try {
      $uid = $GLOBALS['user']->uid;
      switch ($action) {
        case 'create':
          if (
              !array_key_exists('name', $_POST) || !($le = strlen($name = $_POST['name'])) || $le > 32
              || !array_key_exists('require_admin', $_POST) || !(($require_admin = (int)$_POST['require_admin']) == 0 || $require_admin == 1)
          ) {
            header('HTTP/1.1 403 Forbidden');
            exit;
          }
          if (!user_access('log_filter edit filters')) {
            $oResp->success = FALSE;
            $oResp->error_code = 10;
            $oResp->error = 'Missing permission.';
            throw new Exception(
                'Logical error: missing permission \'log_filter edit filters\' for user (' . $uid . ') ' . $GLOBALS['user']->name
                    . ', thus the user should not be presented with the option of saving a filter.'
            );
          }
          elseif (!preg_match('/^[a-z_][a-z\d_]+$/', $name) || $name == 'default' || $name == 'adhoc') { // @IDE: var $name is declared.
            $oResp->success = FALSE;
            $oResp->error_code = 20;
            $oResp->error = 'Invalid machine name[' . $name . '].';
            $oResp->name = $name;
          }
          else {
            $oResp->name = $name = strtolower($name);
            try {
              db_insert('log_filter')->fields(array(
                'name' => $name,
                'creator' => $uid,
                'require_admin' => $require_admin,
                'type' => '', // No default because text field.
                'editor' => $uid,
                'created' => REQUEST_TIME,
              ))
              ->execute();
            }
            catch (PDOException $xc) {
              if ((int)$xc->getCode() == 23000) { // Fair chance that it's a duplicate key error, though 23000 may also (MySQL) mean null error.
                $oResp->success = FALSE;
                $oResp->error_code = 30;
                $oResp->error = 'Filter name[' . $name . '] already exists.';
                LogFilter::_errorHandler($xc);
              }
              else {
                throw $xc;
              }
            }
          }
          break;
        default:
          $oResp->success = FALSE;
          $oResp->error_code = 1;
          $oResp->error = 'Unsupported action[' . $action . '].';
      }
    }
    catch (PDOException $xc) {
      LogFilter::_errorHandler($xc);
      $oResp->success = FALSE;
      $oResp->error_code = 90;
    }
    catch (Exception $xc) {
      LogFilter::_errorHandler($xc);
      $oResp->success = FALSE;
    }

    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store, no-cache, must-revalidate');
    header('Expires: Thu, 01 Jan 1970 00:00:01 GMT');
    //  No reason to use drupal_json_encode(), because we dont send html strings.
    echo json_encode($oResp);
    flush();
    exit;
  }

  /**
   * @param Exception $xc
   * @param integer $severity
   *  - default: WATCHDOG_ERROR
   * @return void
   */
  protected static function _errorHandler($xc, $severity = WATCHDOG_ERROR) {
    if (!inspect_trace($xc, array('category' => 'log_filter', 'severity' => $severity))) {
      watchdog(
        'log_filter',
        $xc->getMessage(),
        NULL,
        WATCHDOG_ERROR
      );
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
function _log_filter_form_submit($form, &$form_state) {
  LogFilter::viewerFormSubmit($form, $form_state);
}