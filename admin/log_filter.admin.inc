<?php
/**
 * @file
 *  Drupal Log Filter module
 */

/**
 * Implements drupal_get_form().
 *
 * Defines configuration form fields.
 *
 * @param array $form
 * @param array &$form_state
 * @return array
 *   - the return value of system_settings_form()
 */
function _log_filter_admin_form($form, &$form_state) {
  drupal_add_css(
      ($path = drupal_get_path('module', 'log_filter')) . '/admin/log_filter.admin.css',
      array('type' => 'file', 'group' => CSS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
  );
  //  Clear menu cache if just submitted.
  if (!empty($_SESSION) && !empty($_SESSION['module']) && !empty($_SESSION['module']['log_filter'])
      && array_key_exists('admin_form_submitted', $_SESSION['module']['log_filter'])) {
    menu_rebuild();
    unset($_SESSION['module']['log_filter']['admin_form_submitted']);
    if (empty($_SESSION['module']['log_filter'])) {
      unset($_SESSION['module']['log_filter']);
      if (empty($_SESSION['module'])) {
        unset($_SESSION['module']);
      }
    }
  }
  $form['general'] = array(
      '#type' => 'fieldset',
      '#title' => t('General settings'),
      '#collapsible' => FALSE,
      '#collapsed' => FALSE,
      'log_filter_hidedblog' => array(
          '#type' => 'checkbox',
          '#title' => t('Hide default \'Recent log messages\' page'),
          '#default_value' => variable_get('log_filter_hidedblog', FALSE),
          '#attributes' => array('autocomplete' => 'off'),
      ),
      'log_filter_trnct' => array(
          '#type' => 'textfield',
          '#title' => t('List view message truncation'),
          '#default_value' => variable_get('log_filter_trnct', 100),
          '#attributes' => array('autocomplete' => 'off'),
          '#size' => 3,
      ),
  );

  $form['#submit'][] = 'log_filter_admin_form_submit';
  return system_settings_form($form);
}

/**
 * @param array $form
 * @param array &$form_state
 * @return void
 */
function _log_filter_admin_form_submit($form, &$form_state) {
  //  Make form clear menu cache upon submission.
  if (!isset($_SESSION['module'])) {
    $_SESSION['module'] = array(
        'log_filter' => array('admin_form_submitted' => TRUE),
    );
  }
  elseif(!isset($_SESSION['module']['log_filter'])) {
    $_SESSION['module']['log_filter'] = array('admin_form_submitted' => TRUE);
  }
  else {
    $_SESSION['module']['log_filter']['admin_form_submitted'] = TRUE;
  }
}