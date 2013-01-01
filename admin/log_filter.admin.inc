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
  drupal_add_js(
      $path . '/admin/log_filter.admin.js',
      array('type' => 'file', 'group' => JS_DEFAULT, 'preprocess' => FALSE, 'every_page' => FALSE)
  );

  $form['general'] = array(
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

  $form['#submit'][] = 'log_filter_admin_form_submit';
  return system_settings_form($form);
}

/**
 * @param array $form
 * @param array &$form_state
 * @return void
 */
function _log_filter_admin_form_submit($form, &$form_state) {
}