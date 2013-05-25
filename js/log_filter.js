/**
 * @file
 *  Drupal Log Filter module
 */

(function($) {

/**
 * Singleton, instantiated to itself.
 * @constructor
 * @namespace
 * @name LogFilter
 * @singleton
 * @param {jQuery} $
 */
var LogFilter = function($) {
  /**
   * @ignore
   * @private
   * @type {LogFilter}
   */
  var self = this,
  /**
   * @ignore
   * @private
   * @type {string}
   */
  _name = "LogFilter",
  /**
   * @ignore
   * @private
   * @type {obj}
   */
  _errorCodes = {
    unknown: 1,
    //  Programmatic errors and wrong use of program.
    algo: 100,
    use: 101,
    //  Missing permission.
    perm_general: 200,
    form_expired: 201,
    perm_filter_crud: 202,
    perm_filter_restricted: 203,
    //  Database.
    db_general: 500,
    //  Misc.
    filter_name_composition: 1001,
    filter_name_nonunique: 1002,
    filter_doesnt_exist: 1003,
    bad_filter_condition: 1010
  },
  /**
   * @ignore
   * @private
   * @type {obj}
   */
  _ = {
    //  {arr}
    errors: [],
    dateFormat: "YYYY-MM-DD",
    dateFormat_datepicker: "yy-mm-dd",
    mode: "default", // default | adhoc | stored | create | edit | delete_filter
    modePrevious: "default",
    name: "",
    origin: "",
    crudFilters: false,
    delLogs: false,
    recordedValues: { // For some fields (having pattern validation) we have to record last value to safely detect change.
      time_range: "",
      uid: "",
      hostname: "",
      location: "",
      referer: "",
      orderBy: []
    },
    warned_deleteNoMax: false,
    saveEditFilterAjaxed: false, // Save/update filter using AJAX or ordinary POST request?
    pagerOffset: 0,
    listMessageTruncate: 250,
    logs: {}
  },
  /**
   * @ignore
   * @private
   * @type {bool|undefined}
   */
  _submitted,
  /**
   * @ignore
   * @private
   * @type {bool|undefined}
   */
  _ajaxRequestingBlocking,
  /**
   * List of previously used localized labels/messages.
   *
   * @ignore
   * @private
   * @type {object}
   */
  _local = {},
  /**
   * @ignore
   * @private
   * @type {obj}
   */
  _selectors = {
    page: "div#page",
    form: "form#log-filter-form",
    settings: {
      mode: "input[name='log_filter_mode']",
      onlyOwn: "input[name='log_filter_only_own']",
      delete_logs_max: "input[name='log_filter_delete_logs_max']", // May not exist.
      translate: "input[name='log_filter_translate']",
      pager_range: "input[name='log_filter_pager_range']"
    },
    filter: {
      filter: "select[name='log_filter_filter']",
      name: "input[name='log_filter_name']", // Hidden.
      origin: "input[name='log_filter_origin']", // Hidden.
      name_suggest: "input[name='log_filter_name_suggest']",
      description: "textarea[name='log_filter_description']",
      require_admin: "input[name='log_filter_require_admin']" // May not exist.
    },
    conditions: {
      time_range: "input[name='log_filter_time_range']", // For iteration: must go before the other time fields.
      time_from: "input[name='log_filter_time_from']",
      time_from_proxy: "input[name='log_filter_time_from_proxy']",
      time_to: "input[name='log_filter_time_to']",
      time_to_proxy: "input[name='log_filter_time_to_proxy']",
      severity_any: "input[name='log_filter_severity[-1]']", // For iteration: must go before severity_some.
      severity_some: "div#edit-log-filter-severity input:not([name='log_filter_severity[-1]'])", // More elements.
      type_any: "input[name='log_filter_type_wildcard']", // For iteration: must go before type_some.
      type_some: "div#edit-log-filter-type input", // We only store the first, because we only need one for getting/setting value.
      role: "select[name='log_filter_role']", // For iteration: must go before uid.
      uid: "input[name='log_filter_uid']",
      hostname: "input[name='log_filter_hostname']",
      location: "input[name='log_filter_location']",
      referer: "input[name='log_filter_referer']"
    },
    orderBy: {
      options: "div.filter-orderby select",
      bools: "div.filter-orderby input[type='checkbox']"
    },
    buttons: {
      //  Not part of filter dialog.
      submit: "input#edit-submit",
      update_list: "input[name='log_filter_update_list']", // Becomes bucket in _elements.buttons.update_list.
      update_list_right: "input[name='log_filter_update_list_right']", // Becomes bucket in _elements.buttons.update_list.
      reset: "input[name='log_filter_reset']",
      //  Filter dialog.
      create: "input[name='log_filter_create']",
      edit: "input[name='log_filter_edit']",
      delete_filter: "input[name='log_filter_delete']",
      cancel: "input[name='log_filter_cancel']",
      save: "input[name='log_filter_save']", // Doesnt exist if user isnt permitted to create|edit|save filter.
      delete_logs_button: "input[name='log_filter_delete_logs_button']"
    },
    misc: {
      title: "#log_filter_title_display"
    }
  },
  _elements = {
    settings: {},
    filter: {},
    conditions: {},
    orderBy: [], // Array.
    buttons: {
      update_list: [],
      crudFilters: [] // create, edit, delete_filter, cancel, save.
    },
    misc: {}
  },
  /**
   * @ignore
   * @private
   * @type {array}
   */
  _filters = [],

  //  Declare private methods, to make IDEs list them
  _errorHandler, _oGet, _toAscii,
  _textareaRemoveWrapper,
  _machineNameConvert, _machineNameIllegals, _machineNameValidate,
  _validateTimeSequence,
  _resize,
  _url, _submit, _prepareForm, _setMode, _crudRelay, _changedCriterion, _resetCriteria, _getCriteria, _deleteLogs,
  _getLogList, _listLogs,
  _ajaxResponse, _ajaxRequest;
  /**
   * @see inspect.errorHandler
   * @ignore
   * @private
   * @param {Error} [error]
   * @param {mixed} [variable]
   * @param {obj|int|bool|str} [options]
   * @return {void}
   */
  _errorHandler = function(error, variable, options) {
    var u = options, o = {}, t;
    //  Do nothing, if inspect is the 'no action' type.
    if(typeof window.inspect === "function" && inspect.tcepsni) {
      if(typeof inspect.errorHandler === "function") {
        if(u) {
          if((t = typeof u) === "string") {
            o.message = u;
          }
          else if(t === "object") {
            o = u;
          }
          //  Otherwise: ignore; use object argument for options if other properties are needed.
        }
        o.category = "log_filter";
        inspect.errorHandler(error, variable, o);
      }
      else {
        inspect.console("Please update Inspect.");
      }
    }
  };
  /**
   * Object/function property getter, Object.hasOwnproperty() alternative.
   *
   * @ignore
   * @param {obj} o
   * @param {str|int} k0
   * @param {str|int} [k1]
   * @return {mixed}
   *  - undefined: o not object, or o doesnt have property k0, or the value of o[k1] is undefined; and the same goes if arg k1 is used
   */
  _oGet = function(o, k0, k1) {
    var t = typeof o;
    return o && (t === "object" || t === "function") && o.hasOwnProperty(k0) ?
        (k1 === undefined ? o[k0] : (
            (o = o[k0]) && ((t = typeof o) === "object" || t === "function") && o.hasOwnProperty(k1) ? o[k1] : undefined
        ) ) : undefined;
  };
  _toAscii = function(s) {
    var ndl = _toAscii.needles, rpl = _toAscii.replacers, le = ndl.length, i, u;
    if(typeof ndl[0] === "string") { // First time called.
      u = ndl.concat();
      for(i = 0; i < le; i++) {
          ndl[i] = new RegExp("\\u" + Judy.toLeading(u[i].charCodeAt(0).toString(16), 4), "g");
      }
    }
    for(i = 0; i < le; i++) {
        s = s.replace(ndl[i], rpl[i]);
    }
    return s;
  };
  /**
   * Removes parent form-textarea-wrapper div from (non-resizable) textarea, for easier (standard) DOM access.
   *
   * @ignore
   * @param {element} elm
   * @return {void}
   */
  _textareaRemoveWrapper = function(elm) {
    var jq;
    if ((jq = $(elm.parentNode)).hasClass("form-textarea-wrapper")) {
      jq.after( $(elm).remove() );
      jq.remove();
    }
  };
  _toAscii.needles = [
    //  iso-8859-1
//JSLINT_IGNORE--- jslint unsafe chars,but _toAscii() starts out converting them to \uNNNN regexes.
    "Ä","Æ","ä","æ","Ö","Ø","ö","ø","Ü","ü","ß","Å","å","À","Á","Â","Ã","à","á","â","ã","Ç","ç","Ð","ð","È","É","Ê","Ë","è","é","ê","ë","Ì","Í","Î","Ï","ì","í","î","ï","Ñ","ñ","Ò","Ó","Ô","Õ","ò","ó","ô","õ","Ù","Ú","Û","ù","ú","û","Ý","ý","ÿ","Þ","þ"
//---JSLINT_IGNORE
  ];
  _toAscii.replacers = [
    //  iso-8859-1
    "Ae","Ae","ae","ae","Oe","Oe","oe","oe","Ue","ue","ss","Aa","aa","A","A","A","A","a","a","a","a","C","c","D","d","E","E","E","E","e","e","e","e","I","I","I","I","i","i","i","i","N","n","O","O","O","O","o","o","o","o","U","U","U","u","u","u","Y","y","y","Th","th"
  ];
  /**
   * @ignore
   * @return {void}
   */
  _machineNameConvert = function() {
    var v = this.value, rgx = /^[a-z\d_]$/;
    if(v.length > 1 && !rgx.test(v)) {
      if(!rgx.test(v = v.toLowerCase())) {
        if(!rgx.test(v = v.replace(/[\ \-]/g, "_"))) {
          if(!rgx.test(v = _toAscii(v))) {
            v = v.replace(/[^a-z\d_]/g, "_");
          }
        }
      }
      this.value = v;
    }
  };
  /**
   * @ignore
   * @type {array}
   */
  _machineNameIllegals = [
    "log_filter",
    "default",
    "adhoc"
  ],
  /**
   * @ignore
   * @param {Event|falsy} evt
   *  - default: falsy (~ use arg elm)
   * @param {element} [elm]
   *  - default: falsy (~ use arg value)
   * @param {string} [value]
   * @param {bool} [noFeedback]
   *  - default: false (~ do pop alert upon validation failure)
   * @return {void}
   */
  _machineNameValidate = function(evt, elm, value, noFeedback) {
    var v = evt ? this.value : (elm ? elm.value : value), le = v.length;
    if(le < 2 || le > 32 || !/[a-z_]/.test(v.charAt(0)) || !/[a-z\d_]/.test(v) || $.inArray(v.toLowerCase(), _machineNameIllegals) > -1) {
      if(!noFeedback) {
        //alert( self.local("error_machine_name_composition", {"!illegals": _machineNameIllegals.join(", ")}) );
        self.Message.set( self.local("error_machine_name_composition", {"!illegals": _machineNameIllegals.join(", ")}), "warning", {
          modal: true,
          close: function() {
            Judy.focus(_elements.filter.name_suggest);
          }
        });
      }
      return false;
    }
    return true;
  };
  /**
   * @ignore
   * @param {string} nm
   * @return {void}
   */
  _validateTimeSequence = function(nm) {
    var o = _elements.conditions, v, from = (v = o.time_from.value) ? parseInt(v, 10) : 0, to;
    if(from && (to = (v = o.time_to.value) ? parseInt(v, 10) : 0) && from > to) {
      o[ "time_" + nm ].value = o[ "time_" + nm + "_proxy" ].value = o[ "time_" + nm + "_time" ].value = "";
      //alert(self.local("invalid_timeSequence_" + nm));
      self.Message.set( self.local("invalid_timeSequence_" + nm), "warning", { modal: true });
    }
  };
	/**
   * @ignore
   * @param {Event} [evt]
   * @param {bool} [initially]
	 * @return {void}
	 */
	_resize = function(evt, initially) {
		var jq, o;
    //  Detect small viewport.
    //  If small, then the filter box will float/fall down below the criteria box.
    //  Because there isnt room for it.
    //  And thus the filter box will be placed at the same offset from window left as the criteria box.
    if(_.useModuleCss) {
      o = (jq = $("#log_filter_criteria")).offset();
      $("#page")[
        (o.left + jq.outerWidth(true) + $("div#log_filter_filters_cell_0").outerWidth(true)) >
          (Judy.innerWidth(window) - 20) ? // 20 ~ To prevent ambiguity.
          "addClass" : "removeClass"
      ]("log-filter-viewport-small");
    }
    if(initially) {
      Judy.overlay(0);
      $(window).resize(_resize);
    }
	};
  /**
   * @ignore
   * @param {boolean} [top]
   *  - default: false (~ use current window's location, not top.location)
   * @return {string}
   */
  _url = function(top) {
    var loc = (!top ? window : top).location, v;
    return loc.protocol + "//" + loc.hostname + (!(v = loc.port) ? "" : (":" + v)) + loc.pathname.replace(/\/dblog(\/.+)?$/, "/dblog/log_filter");
  };
  /**
   * @ignore
   * @return {void}
   */
  _submit = function() {
    var nm = "", v;
    if(_submitted) {
      return;
    }
    _submitted = true;
    switch(_.mode) {
      case "adhoc":
        nm = "adhoc";
        break;
      case "stored":
        nm = _.name;
        break;
    }
    _elements.form.setAttribute(
      "action",
      _elements.form.getAttribute("action").replace(/\/dblog(\/[^\?\&]+)([\?\&].+)?$/, "/dblog/log_filter/" + nm + "$2")
    );
    //  Delay; otherwise it may in some situations not submit, presumably because Judy.enable() hasnt finished it's job yet(?).
    setTimeout(function() {
      $(_elements.buttons.submit).trigger("click");
    }, 100);
  };
  /**
   * @ignore
   * @return {void}
   */
  _prepareForm = function() {
    var oSels, oElms, nm, jq, elm, aElms, a, le, i, v, nOrderBy, u, elm2, d;
    try {
      _elements.page = $(_selectors.page).get(0);
      _elements.form = $(_selectors.form).get(0);
      //  Filter; do first because we need references to name and origin.
      oSels = _selectors.filter;
      oElms = _elements.filter;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          oElms[nm] = elm;
          switch(nm) {
            case "filter":
              //  Selecting a stored filter means submit form.
              jq.change(function() {
                var v;
                _elements.filter.name.value = _.name = v = Judy.fieldValue(this);
                _elements.settings.mode.value = _.mode = v ? "stored" : "default";
                if(!v) { // default|adhoc
                  _resetCriteria(null, "default");
                  return;
                }
                _resetCriteria(null, "default", true); // Prevent ugly 'Illegal choice' error for type condition.
                Judy.enable(_elements.buttons.update_list);
                _submit();
              });
              break;
            case "name_suggest": // May not exist.
              jq.keyup(_machineNameConvert);
              break;
            case "description": // May not exist.
              _textareaRemoveWrapper(elm); // Remove parent form-textarea-wrapper.
              jq.change(function() {
                var v;
                if((v = this.value)) {
                  this.value = Judy.stripTags(v);
                }
              });
              break;
          }
        }
      }
      _.name = _elements.filter.name.value;
      _.origin = _elements.filter.origin.value;
      //  Fields; get element references, and fix some issues.
      //  Settings.
      oSels = _selectors.settings;
      oElms = _elements.settings;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          oElms[nm] = elm;
          switch(nm) {
            case "mode":
              //  Get mode.
              _.mode = elm.value;
              break;
            case "onlyOwn": // May not exist.
              //  Submit if user (un)checks filter_only_own.
              jq.change(function() {
                if(_.mode === "stored") {
                  _elements.settings.mode.value = "adhoc";
                  Judy.fieldValue(_elements.filter.filter, null, "");
                  _elements.filter.origin.value = _.name; // Pass name to origin.
                  _elements.filter.name.value = "";
                }
                Judy.enable(_elements.buttons.update_list);
                _submit();
              });
              break;
            case "delete_logs_max": // May not exist.
              jq.change(function() {
                var v = this.value;
                if(v !== "") {
                  if((v = $.trim(v)) !== "" && !/^[1-9]\d*$/.test(v)) {
                    v = "";
                  }
                  this.value = v;
                }
              });
              break;
          }
        }
      }
      //  Conditions.
      oSels = _selectors.conditions;
      oElms = _elements.conditions;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          switch(nm) {
            case "time_range":
              oElms[nm] = elm;
              _.recordedValues[nm] = elm.value;
              //  Clear time_to and time_from when setting a time_range.
              jq.change(function() {
                var v = this.value, o;
                if(v !== "") {
                  this.value = v = $.trim(v);
                }
                if(v !== "") {
                  if(v === "0" || !/^[1-9]\d*$/.test(v)) {
                    this.value = v = "";
                  }
                  else {
                    (o = _elements.conditions).time_from.value =
                      o.time_from_proxy.value =
                      o.time_from_time.value =
                      o.time_to.value =
                      o.time_to_proxy.value =
                      o.time_to_time.value = "";
                  }
                }
                if(v !== _.recordedValues.time_range) {
                  _.recordedValues.time_range = v;
                  _changedCriterion();
                }
              });
              break;
            case "time_from": // Hidden fields.
            case "time_to":
              oElms[nm] = elm;
              break;
            case "time_from_proxy":
            case "time_to_proxy":
              oElms[nm] = elm;
              u = nm === "time_from_proxy" ? "from" : "to";
              //  Create time field.
              jq.after(
                "<input class=\"form-text\" type=\"text\" maxlength=\"8\" size=\"8\" value=\"\" name=\"log_filter_time_" + u + "_time\" autocomplete=\"off\" />"
              );
              //  Put jQuery UI datepicker on time fields.
              jq.datepicker({
                dateFormat: _.dateFormat_datepicker
              });
              //  Refer time field.
              oElms[ "time_" + u + "_time" ] = elm2 = $("input[name=\'log_filter_time_" + u + "_time\']").get(0);
              //  Set datepicker and time field values.
              if((v = _elements.conditions[ u === "from" ? "time_from" : "time_to" ].value) && (v = parseInt(v, 10))) {
                jq.datepicker("setDate", d = new Date(v * 1000));
                elm2.value = Judy.timeFormat(d);
              }
              //  Date proxy field handler.
              jq.change(function() {
                var v, d, nm = this.name.indexOf("from") > 1 ? "from" : "to", r = _elements.conditions[ "time_" + nm ],
                  rT = _elements.conditions[ "time_" + nm + "_time" ];
                if((v = $.trim(this.value)).length) {
                  if((d = Judy.dateFromFormat(v, _.dateFormat))) {
                    _.recordedValues.time_range = _elements.conditions.time_range.value = ""; // Clear time_range.
                    rT.value = Judy.timeFormat(d, rT.value);
                    r.value = v = Math.floor(d.getTime() / 1000);
                    //  If time_to, and same as time_from, and no hours/minutes/seconds: make time_to the end of the day.
                    if(nm === "to" && ("" + v) === _elements.conditions.time_from.value &&
                      d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0
                    ) {
                      rT.value = Judy.timeFormat(d, "24");
                      r.value = Math.floor(d.getTime() / 1000);
                    }
                    else {
                      _validateTimeSequence(nm);
                    }
                  }
                  else {
                    //alert( self.local("invalid_date", {"!date": v, "!format": _.dateFormat}) );
                    self.Message.set( self.local("invalid_date", {"!date": v, "!format": _.dateFormat}), "warning", { modal: true });
                    r.value = "";
                    return; // No change, skip _changedCriterion()
                  }
                }
                _changedCriterion();
              });
              //  Time field handler.
              $(elm2).change(function() {
                var nm = this.name.indexOf("from") > -1 ? "from" : "to", rD = _elements.conditions[ "time_" + nm ], d;
                //  Cant set time when no date.
                if(!(d = rD.value)) {
                  this.value = "";
                  return;
                }
                d = new Date(d * 1000);
                this.value = Judy.timeFormat(d, this.value);
                rD.value = Math.floor(d / 1000);
                _validateTimeSequence(nm);
                _changedCriterion();
              });
              break;
            case "severity_any":
              oElms[nm] = elm;
              //  Un-check specific severities upon checking severity:any.
              jq.change(function() {
                var a = _elements.conditions.severity_some, le = a.length, i, v;
                if(this.checked) { // Un-check all severity_some.
                  for(i = 0; i < le; i++) {
                    a[i].checked = false;
                  }
                }
                else { // If no severity_some, re-check severity_any.
                  for(i = 0; i < le; i++) {
                    if(a[i].checked) {
                      v = true;
                      break;
                    }
                  }
                  if(!v) {
                    this.checked = "checked";
                    return; // No change.
                  }
                }
                _changedCriterion();
              });
              break;
            case "severity_some": // More elements.
              oElms[nm] = jq.get();
              //  Un-check severity:any upon change in list of severity.
              jq.change(function() {
                var a, le, i;
                if(this.checked) {
                  _elements.conditions.severity_any.checked = false;
                }
                else {
                  le = (a = _elements.conditions.severity_some).length;
                  for(i = 0; i < le; i++) {
                    if(a[i].checked) {
                      return;
                    }
                  }
                  _elements.conditions.severity_any.checked = "checked";
                }
                _changedCriterion();
              });
              break;
            case "type_any": // check list
              oElms[nm] = elm;
              jq.change(function() {
                var elm;
                if(this.checked && // Uncheck all of type_some.
                    (elm = _elements.conditions.type_some) // Doesnt exists if no logs at all.
                ) {
                  Judy.fieldValue(elm, null, "", "checkboxes");
                }
                _changedCriterion();
              });
              break;
            case "type_some":  // check list
              oElms[nm] = elm;
              if(elm) { // Doesnt exists if no logs at all.
                jq.change(function() {
                  if(this.checked) { // Un-check type_any.
                    _elements.conditions.type_any.checked = false;
                  }
                  else if(!Judy.fieldValue(_elements.conditions.type_some)) {
                    _elements.conditions.type_any.checked = "checked";
                  }
                  _changedCriterion();
                });
              }
              break;
            case "role":
              oElms[nm] = elm;
              //  Clear uid when selecting a role.
              jq.change(function() {
                if(Judy.fieldValue(this)) {
                  _elements.conditions.uid.value = "";
                }
                _changedCriterion();
              });
              break;
            case "uid":
              oElms[nm] = elm;
              _.recordedValues[nm] = elm.value;
              //  Clear role when setting a uid.
              jq.change(function() {
                var v = this.value;
                if(v !== "") {
                  this.value = v = $.trim(v);
                }
                if(v !== "") {
                  if(v === "0" || !/^[1-9]\d*$/.test(v)) {
                    if(v !== "0") {
                      //alert(self.local("invalid_uid"));
                      self.Message.set( self.local("invalid_uid"), "warning", {
                          modal: true,
                          close: function() {
                            Judy.focus(_elements.conditions.uid);
                          }
                      });
                    }
                    this.value = v = "";
                  }
                  else {
                    Judy.fieldValue(_elements.conditions.role, null, ""); // Clear role when setting a uid.
                  }
                }
                if(v !== _.recordedValues.uid) {
                  _.recordedValues.uid = v;
                  _changedCriterion();
                }
              });
              break;
            case "hostname":
              oElms[nm] = elm;
              _.recordedValues[nm] = elm.value;
              jq.change(function() {
                var v = this.value;
                if(v !== "") {
                  this.value = v = Judy.stripTags(v);
                }
                if(v !== _.recordedValues.hostname) {
                  _.recordedValues.hostname = v;
                  _changedCriterion();
                }
              });
              break;
            case "location":
            case "referer":
              oElms[nm] = elm;
              _.recordedValues[nm]= elm.value;
              //  Check for url pattern.
              jq.change(function() {
                var v = $.trim(this.value), nm = this.name === "log_filter_location" ? "location" : "referer"; // Not the same nm as iteration nm ;-)
                if(nm === "referer" && (v === "none" || v === "<none>")) {
                  this.value = "none";
                }
                else {
                  if(v !== "") {
                    this.value = v = Judy.stripTags(v);
                  }
                  if(v !== "" && !/^https?\:\/\/.+$/.test(v)) {
                    if(!/^https?\:\/\/.+$/.test(v = "http://" + v)) {
                      self.Message.set( self.local(nm === "location" ? "invalid_location" : "invalid_referer"), "warning", {
                          modal: true,
                          close: function() {
                            Judy.focus(_elements.conditions[ nm ]);
                          }
                      });
                      this.value = v = "";
                    }
                    else {
                      this.value = v;
                    }
                  }
                }
                if(v !== _.recordedValues[nm]) {
                  _.recordedValues[nm] = v;
                  _changedCriterion();
                }
              });
              break;
            default:
              oElms[nm] = elm;
              jq.change(_changedCriterion); // Criterion change handler.
          }
        }
      }
      //  Order by.
      oElms = _elements.orderBy; // Array.
      if((nOrderBy = (aElms = $(_selectors.orderBy.options).get()).length)) {
        for(i = 0; i < nOrderBy; i++) {
          oElms.push(
            [ elm = aElms[i] ]
          );
          _.recordedValues.orderBy.push(Judy.fieldValue(elm));
          //  There can't be two orderBys having same value.
          $(elm).change(function() {
            var v, index, i, a;
            if((v = Judy.fieldValue(this)) && v !== "_none") {
              index = parseInt(this.name.replace(/^log_filter_orderby_/, ""), 10) - 1;
              a = _elements.orderBy;
              for(i = 0; i < nOrderBy; i++) {
                if(i !== index && Judy.fieldValue(a[i][0]) === v) {
                  Judy.fieldValue(this, null, v = "");
                  break;
                }
              }
            }
            if(v !== _.recordedValues.orderBy[index]) {
              _.recordedValues.orderBy[index] = v;
              _changedCriterion();
            }
          });
        }
        if((le = (aElms = $(_selectors.orderBy.bools).get()).length)) {
          for(i = 0; i < le; i++) {
            oElms[i].push(
              elm = aElms[i]
            );
            $(elm).change(_changedCriterion);
          }
        }
      }

      //  Miscellaneous.
      oSels = _selectors.misc;
      oElms = _elements.misc;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          oElms[nm] = elm;
        }
      }

      //  Buttons; get element references, and fix some issues.
      oSels = _selectors.buttons;
      oElms = _elements.buttons;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          switch(nm) {
            case "submit":
              //  Hidden, but we do submit by triggering a click on it anyway, in case Form API sets some javascript behaviour on it.
              //  ...jQuery behaviour, really. Because a jQuery(elm).trigger("click") apparantly doesnt trigger a real click event(?).
              oElms[nm] = elm;
              break;
            case "update_list":
            case "update_list_right":
              oElms.update_list.push(elm);
              elm.setAttribute("type", "button");
              jq.unbind(); // Remove Drupal native button handlers.
              jq.click(function() {
                _ajaxRequestingBlocking = true; // Prevent consecutive clicks on update buttons.
                _getLogList();
              });
              break;
            default:
              oElms[nm] = elm;
              elm.setAttribute("type", "button"); // Fix type (apparant Form API shortcoming).
              jq.unbind(); // Remove Drupal native button handlers.
              switch(nm) {
                case "create":
                case "edit":
                case "delete_filter":
                case "cancel":
                case "save":
                  _.crudFilters = true;
                  oElms.crudFilters.push(elm);
                  jq.click(_crudRelay); // Set our common button handler.
                  break;
                case "delete_logs_button":
                  _.delLogs = true;
                  jq.click(_crudRelay); // Set our common button handler.
                  break
                case "reset":
                  jq.click(_resetCriteria);
                  break
              }
          }
        }
      }

      //  Prevent click on hover title label span from resulting in checking/unchecking checkbox.
      $("label span").click(function(evt) {
        evt.stopPropagation();
        return false;
      });
    }
    catch(er) {
      _errorHandler(er, 0, _name + "._prepareForm()");
    }
  };

  /**
   * Sets current mode.
   *
   * Values:
   * - default
   * - adhoc
   * - stored
   * - create
   * - edit
   * - delete
   *
   * @ignore
   * @param {string} mode
   * @param {boolean} [submit]
   * @param {boolean} [initially]
   * @return {void}
   */
  _setMode = function(mode, submit, initially) {
    var fromMode = _.mode, doSubmit, elm, nm;
    try {
      if(_submitted) {
        return;
      }
      if(!initially && mode !== "delete_filter") {
        if(!submit && _.crudFilters) {
          //  Hide all filter buttons.
          $(_elements.buttons.crudFilters).hide();
        }
        if(_.delLogs) {
          Judy.disable(_elements.buttons.delete_logs_button, null, self.local("deleteLogs_prohibit"));
        }
      }
      switch(mode) {
        case "default":
          $("option[value='']", _elements.filter.filter).html( self.local("default") ); // Set visual value of filter selector's empty option.
          $(_elements.misc.title).html(self.local("default"));
          if(!initially) {
            Judy.fieldValue(_elements.filter.filter, null, "");
            _elements.filter.name.value = _.name = _elements.filter.origin.value = _.origin = "";
            Judy.enable(_elements.buttons.update_list);
          }
          if(_.crudFilters) {
            $(_elements.settings.onlyOwn.parentNode).show();
            $(_elements.buttons.create).show();
            if ((elm = _elements.filter.require_admin)) {
              $(elm.parentNode).hide();
            }
            $(_elements.filter.name_suggest.parentNode).hide();
            $(_elements.filter.name_suggest.parentNode.parentNode).hide(); // To secure correct display of delete_logs when .viewport-narrow.
            $(_elements.filter.description.parentNode).hide();
          }
          if(_.delLogs) {
            $(_elements.settings.delete_logs_max).show();
            $(elm = _elements.buttons.delete_logs_button).show();
            $(elm.parentNode).show();
          }
          if(fromMode === "create") {
            fromMode = ""; // Dont keep 'create' as _.modePrevious.
          }
          break;
        case "adhoc":
          if(!initially) {
            Judy.fieldValue(_elements.filter.filter, null, "");
            Judy.enable(_elements.buttons.update_list);
          }
          if(fromMode === "stored") {
            //  Pass current name to origin field.
            _elements.filter.origin.value = _.origin = nm = _.name;
            _elements.filter.name.value = _.name = "";
            $("option[value='']", _elements.filter.filter).html("(" + nm + ")"); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html( self.local("adhocForOrigin", {"!origin": nm} ) );
          }
          else {
            fromMode = ""; // Dont keep 'create' as _.modePrevious.
            $("option[value='']", _elements.filter.filter).html(self.local("adhoc")); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html(self.local("adhoc"));
          }
          if(_.crudFilters) {
            $(_elements.settings.onlyOwn.parentNode).show();
            $(_elements.buttons.create).show();
            if ((elm = _elements.filter.require_admin)) {
              $(elm.parentNode).hide();
            }
            $(_elements.filter.name_suggest.parentNode).hide();
            $(_elements.filter.name_suggest.parentNode.parentNode).hide(); // To secure correct display of delete_logs when .viewport-narrow.
            $(_elements.filter.description.parentNode).hide();
          }
          Judy.enable(_elements.buttons.update_list);
          if(_.delLogs) {
            $(_elements.settings.delete_logs_max).show();
            $(elm = _elements.buttons.delete_logs_button).show();
            $(elm.parentNode).show();
          }
          break;
        case "stored": // stored mode may only appear on page load and after cancelling create.
          if(!initially) {
            if(fromMode === "create") {
              _elements.filter.name.value = _.name = _.origin;
              _elements.filter.origin.value = _.origin = "";
            }
            Judy.fieldValue(elm = _elements.filter.filter, null, nm = _.name);
            $("option[value='']", elm).html( self.local("default") ); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html( nm );
            if(_.crudFilters) {
              if ((elm = _elements.filter.require_admin)) {
                $(elm.parentNode).hide();
              }
              $(_elements.filter.name_suggest.parentNode).hide();
              $(_elements.filter.description.parentNode).hide();
            }
            Judy.enable(_elements.buttons.update_list);
          }
          if(_.crudFilters) {
            $(_elements.filter.name_suggest.parentNode.parentNode).hide(); // To secure correct display of delete_logs when .viewport-narrow.
            $(_elements.settings.onlyOwn.parentNode).show();
            $(_elements.buttons.create).show();
            $(_elements.buttons.edit).show();
            $(_elements.buttons.delete_filter).show();
          }
          if(_.delLogs) {
            $(_elements.settings.delete_logs_max).show();
            $(elm = _elements.buttons.delete_logs_button).show();
            $(elm.parentNode).show();
          }
          switch(fromMode) {
            case "create":
            case "edit":
              fromMode = "stored"; // Dont keep 'create' as _.modePrevious.
              break;
          }
          break;
        case "create":
          if(!_.crudFilters) {
            throw new Error("Mode[" + mode + "] not allowed.");
          }
          switch(fromMode) {
            case "default":
            case "adhoc":
              $("option[value='']", _elements.filter.filter).html("(" + self.local("newName") + ")"); // Set visual value of filter selector's empty option.
              $(_elements.misc.title).html( self.local("newTitle") );
              break;
            case "stored":
              Judy.fieldValue(_elements.filter.filter, null, "");
              //  Pass current name to origin field.
              _elements.filter.origin.value = _.origin = nm = _.name;
              _elements.filter.name.value = _.name = "";
              $("option[value='']", _elements.filter.filter).html("(" + nm + ")"); // Set visual value of filter selector's empty option.
              $(_elements.misc.title).html( self.local("newForOrigin", {"!origin": nm} ) );
              break;
            default:
              throw new Error("Cant create from mode[" + fromMode + "].");
          }
          $(_elements.settings.onlyOwn.parentNode).hide();
          $(_elements.filter.name_suggest.parentNode).show();
          $(_elements.filter.name_suggest.parentNode.parentNode).show(); // To secure correct display of delete_logs when .viewport-narrow.
          if ((elm = _elements.filter.require_admin)) {
            $(elm.parentNode).show();
          }
          $(_elements.filter.description.parentNode).show();
          $(_elements.buttons.save).show();
          $(_elements.buttons.cancel).show();
          Judy.disable(_elements.buttons.update_list);
          if(_.delLogs) {
            $(_elements.buttons.delete_logs_button.parentNode).hide();
          }
          break;
        case "edit":
          if(!_.crudFilters) {
            throw new Error("Mode[" + mode + "] not allowed.");
          }
          if(fromMode === "create") {
            //  If going from create to edit: memorize mode right before create, to prevent ending up having (useless) create as previous mode.
            fromMode = _.modePrevious;
            $("option[value='']", elm = _elements.filter.filter).after(
              "<option value=\"" + (nm = _.name) + "\">" + nm + "</option>"
            );
            $("option[value='']", elm).html( self.local("default") );
            Judy.fieldValue(elm, null, nm);
          }
          if ((elm = _elements.filter.require_admin)) {
            $(elm.parentNode).show();
            $(elm.parentNode.parentNode).show(); // To secure correct display of delete_logs when .viewport-narrow.
          }
          else {
            $(_elements.filter.name_suggest.parentNode.parentNode).hide(); // To secure correct display of delete_logs when .viewport-narrow.
          }
          $(_elements.filter.name_suggest.parentNode).hide();
          $(_elements.filter.description.parentNode).show();
          $(_elements.buttons.cancel).show();
          $(_elements.buttons.save).show();
          Judy.disable(_elements.buttons.update_list); // @todo: no, because update buttons must be ajaxed
          $(_elements.settings.onlyOwn.parentNode).hide();
          if(_.delLogs) {
            $(_elements.buttons.delete_logs_button.parentNode).hide();
          }
          break;
        case "delete_filter": // Pop confirm(), and submit upon positive confirmation.
          if(!_.crudFilters) {
            throw new Error("Mode[" + mode + "] not allowed.");
          }
          Judy.overlay(1, true); // Opaque.
          if (_elements.filter.name.value) {
            if(!confirm( self.local(
              "confirmDelete",
              {"!filter": _elements.filter.name.value}
            ))) {
              Judy.overlay(0);
              return;
            }
            doSubmit = true;
            Judy.overlay(1, false, self.local("wait")); // Transparent.
          }
          else {
            throw new Error("Cant delete filter having empty name[" + _elements.filter.name.value + "].");
          }
          break;
        default:
          throw new Error("Mode[" + mode + "] not supported.");
      }
      _.modePrevious = fromMode;
      _elements.settings.mode.value = _.mode = mode;
      if(submit || doSubmit) {
        _submit();
      }
    }
    catch(er) {
      _errorHandler(er, 0, _name + "._setMode()");
    }
  };
  /**
   * Common handler for all CRUD buttons.
   *
   * @ignore
   * @return {void}
   */
  _crudRelay = function() {
    var nm = this.name, // The element's name, not _.name.
      elm, v, rqa;
    try {
      switch(nm) {
        case "log_filter_reset":
          _resetCriteria();
          break;
        case "log_filter_create":
          _setMode("create");
          Judy.focus(_elements.filter.name_suggest);
          break;
        case "log_filter_edit":
          _setMode("edit");
          break;
        case "log_filter_delete":
          _setMode("delete_filter");
          break;
        case "log_filter_cancel":
          switch(_.mode) {
            case "create":
            case "edit":
              switch(_.modePrevious) {
                case "default":
                case "adhoc":
                  break;
                case "stored":
                  break;
                default:
                  throw new Error("Previous mode[" + _.modePrevious + "] not supported when cancelling.");
              }
              _setMode(_.modePrevious);
              break;
            default:
              throw new Error("Cant cancel in mode[" + _.mode + "].");
          }
          break;
        case "log_filter_save":
          if(_.mode === "edit" && !_.saveEditFilterAjaxed) {
            _submit();
          }
          else {
            //  Prevent double-click.
            if(_ajaxRequestingBlocking) {
              return false; // false for IE<9's sake.
            }
            if(_.mode === "create") {
              //  No reason to trim(), because change handler (_machineNameChange()) replaces spaces with underscores.
              if(!_machineNameValidate(null, null, v = (elm = _elements.filter.name_suggest).value)) {
                Judy.focus(elm);
                return false; // false for IE<9's sake.
              }
              if($.inArray(v, _filters) > -1) {
                Judy.overlay(1, true);
                self.Message.set(self.local("error_filter_name_nonunique", {"!name": v}), "warning");
                return false; // false for IE<9's sake.
              }
              nm = v;
              rqa = _elements.filter.require_admin ? 1 : 0; // Create with require_admin if the element exists (the user has the permission).
            }
            else {
              nm = _.name;
              rqa = (elm = _elements.filter.require_admin) && Judy.fieldValue(elm);
            }
            Judy.overlay(1, false, self.local("wait_" + _.mode));
            _ajaxRequestingBlocking = true;
            v = _getCriteria();
            _ajaxRequest("filter_" + _.mode, { // filter_create|filter_edit
              name: nm,
              filter: {
                require_admin: rqa,
                description: $.trim(Judy.stripTags(_elements.filter.description.value).replace(/[\r\n\t]/g, " ").replace(/\ +/g, " ")).substr(0, 255)
              },
              conditions: v.conditions,
              order_by: v.order_by
            });
          }
          break;
        case "log_filter_delete_logs_button":
          if(_.delLogs) {
            Judy.overlay(1, false, self.local("wait"));
            setTimeout(_deleteLogs, 200);
          }
          else {
            throw new Error("Button name[" + nm + "] not allowed.");
          }
          break;
        default:
          throw new Error("Unsupported button name[" + nm + "].");
      }
    }
    catch(er) {
      _errorHandler(er, 0, _name + "._crudRelay()");
    }
    return false; // false for IE<9's sake.
  };
  /**
   * Change handler for all condition and orderBy fields.
   *
   * @ignore
   * @return {void}
   */
  _changedCriterion = function() {
    try {
      switch(_.mode) {
        case "default":
          _setMode("adhoc");
          break;
        case "adhoc":
          if(_.delLogs) {
            Judy.disable(_elements.buttons.delete_logs_button, null, self.local("deleteLogs_prohibit")); // Because we don't _setMode(), which does that.
          }
          break;
        case "stored":
          //  A change of a stored filter triggers edit mode if the user is allowed to edit filters.
          _setMode(!_.crudFilters ? "adhoc" : "edit");
          break;
        case "create":
          break;
        case "edit":
          break;
        case "delete_filter":
          break;
        default:
          throw new Error("Mode[" + _.mode + "] not supported.");
      }
    }
    catch(er) {
      _errorHandler(er, 0, _name + "._changedCriterion()");
    }
  };
  /**
   * Clear all condition and orderby fields, and set defaults.
   *
   * @ignore
   * @param {Event} [evt]
   *  - when used as event handler
   * @param {string|falsy} [mode]
   *  - set mode to that
   * @param {boolean} [noModeChange]
   *  - do not change mode
   * @return {void}
   */
  _resetCriteria = function(evt, mode, noModeChange) {
    var o = _elements.conditions, nm, r, a, le, i;
    for(nm in o) {
      if(o.hasOwnProperty(nm)) {
        r = o[nm];
        //  Default to severity any and type any.
        switch(nm) {
          case "severity_any":
          case "type_any":
            r.checked = true;
            break;
          case "severity_some": // Array.
            le = r.length;
            for(i = 0; i < le; i++) {
              r[i].checked = false;
            }
            break;
          case "type_some":
            if(r) { // Doesnt exists if no logs at all.
              Judy.fieldValue(r, null, "", "checkboxes");
            }
            break;
          default:
            r.value = "";
        }
      }
    }
    le = (a = _elements.orderBy).length;
    //  Default to order by time ascending, only.
    for(i = 0; i < le; i++) {
      Judy.fieldValue(a[i][0], null, i ? "" : "time");
      a[i][1].checked = i ? false : "checked";
    }
    if(!noModeChange) {
      //  Degrade mode.
      if(mode) {
        _setMode(mode);
      }
      else {
        _setMode("default");
      }
    }
  };
  /**
   * For querying backend.
   *
   * Must be called delayed (after displaying overlay) to secure that validation (set-up in _prepareForm()) has done it's job.
   *
   * @ignore
   * @return {object}
   */
  _getCriteria = function() {
    var n = 0, conditions = {}, order_by = [], oElms = _elements.conditions, nm, r, v, le, i;
    try {
      //  Rely on validation set-up in _prepareForm(), dont do the same thing once over.
      for(nm in oElms) {
        if(oElms.hasOwnProperty(nm)) {
          r = oElms[nm];
          switch(nm) {
            case "time_from_proxy":
            case "time_to_proxy":
            case "time_from_time":
            case "time_to_time":
              break;
            case "time_range":
            case "time_from":
            case "time_to":
            case "uid":
              if((v = r.value) !== "" && (v = $.trim(v)) && (v = parseInt(v, 10))) {
                ++n;
                conditions[nm] = v;
              }
              break;
            case "role":
              if((v = Judy.fieldValue(r)) !== "" && v !== "_none" && (v = $.trim(v)) && (v = parseInt(v, 10))) {
                ++n;
                conditions[nm] = v;
              }
              break;
            case "severity_any":
            case "type_any":
              //  Check at severity_some/type_some instead.
              break;
            case "severity_some":
              if(!oElms.severity_any.checked) {
                v = [];
                le = r.length;
                for(i = 0; i < le; i++) {
                  if(r[i].checked) {
                    v.push(r[i].value);
                  }
                }
                if(v.length) {
                  ++n;
                  conditions.severity = v;
                }
              }
              break;
            case "type_some": // check list
              if(!oElms.type_any.checked &&
                  oElms.type_some && // Doesnt exists if no logs at all.
                  (v = Judy.fieldValue(oElms.type_some))
              ) {
                ++n;
                conditions.type = v;
              }
              break;
            case "hostname":
            case "location":
            case "referer":
              if((v = r.value) !== "" && (v = $.trim(v))) {
                ++n;
                conditions[nm] = v;
              }
              break;
            default:
              throw new Error("Condition[" + nm + "] not supported.");
          }
        }
      }
      le = (oElms = _elements.orderBy).length;
      for(i = 0; i < le; i++) {
        if((v = Judy.fieldValue(oElms[i][0])) && v !== "_none" && (v = $.trim(v))) {
          order_by.push([
            v,
            oElms[i][1].checked ? "DESC" : "ASC"
          ]);
        }
      }
    }
    catch(er) {
      _errorHandler(er, 0, _name + "._getCriteria()");
    }
    return {
      nConditions: n,
      conditions: conditions,
      order_by: order_by
    };
  };
  /**
   * @ignore
   * @return {void}
   */
  _deleteLogs = function() {
    var o = _getCriteria(), v, max = (v = _elements.settings.delete_logs_max.value) !== "" ? v : 0;
    if(!o.nConditions) { // Even stored filters go here; if a stored filter has no conditions, than THAT is the important thing.
      //  We warn every time, when no conditions at all.
      if(!max) {
        if(!confirm( self.local("deleteLogs_all") )) {
          Judy.overlay(0);
          Judy.focus(_elements.settings.delete_logs_max);
          return;
        }
      }
      else if(!confirm( self.local("deleteLogs_noConditions", {"!number": v}) )) {
        Judy.overlay(0);
        Judy.focus(_elements.settings.delete_logs_max);
        return;
      }
    }
    else if(_.mode === "stored") {
      if(!max) {
        if(!confirm( self.local("deleteLogs_storedNoMax", {"!name": _.name}) )) {
          _.warned_deleteNoMax = true;
          Judy.overlay(0);
          Judy.focus(_elements.settings.delete_logs_max);
          return;
        }
      }
      else if(!_.warned_deleteNoMax && !confirm( self.local("deleteLogs_stored", {"!name": _.name, "!number": v}) )) {
        Judy.overlay(0);
        Judy.focus(_elements.settings.delete_logs_max);
        return;
      }
    }
    else if(!max) {
      if(!confirm( self.local("deleteLogs_adhocNoMax") )) {
        _.warned_deleteNoMax = true;
        Judy.overlay(0);
        Judy.focus(_elements.settings.delete_logs_max);
        return;
      }
    }
    else if(!_.warned_deleteNoMax && !confirm( self.local("deleteLogs_adhoc", {"!number": v}) )) {
      Judy.overlay(0);
      Judy.focus(_elements.settings.delete_logs_max);
      return;
    }
    _ajaxRequestingBlocking = true;
    v = _getCriteria();
    _ajaxRequest("delete_logs", {
      conditions: v.conditions,
      order_by: v.order_by,
      offset: _.pagerOffset,
      max: !max ? 0 : parseInt(max)
    });
  }

  /**
   * @ignore
   * @return {void}
   */
  _getLogList = function() {
    var v = _getCriteria();
    Judy.overlay(1, false, self.local("wait"));
    _ajaxRequest("list_logs", {
      conditions: v.conditions,
      order_by: v.order_by,
      offset: _.pagerOffset,
      max: _elements.settings.pager_range.value,
      translate: Judy.fieldValue(_elements.settings.translate)
    });
  };

  /**
   * @ignore
   * @param {array} logs
   * @param {integer} nTotal
   * @return {void}
   */
  _listLogs = function(logs, nTotal) {
    var le = logs.length, i, o, v, css = 'log-filter-list', s;
    _.logs = {};
    for(i = 0; i < le; i++) {
      o = logs[i];
      //  Replace variables if exist and not done already by backend (is done if translate is on).
      if(o.variables) {
        o.message = Drupal.formatString(o.message, o.variables);
      }
      delete o.variables;
      //  Resolve severity.
      switch("" + o.severity) {
        case "1": // WATCHDOG_ALERT
          v = "alert";
          break;
        case "2": // WATCHDOG_CRITICAL
          v = "critical";
          break;
        case "3": // WATCHDOG_ERROR
          v = "error";
          break;
        case "4": // WATCHDOG_WARNING
          v = "warning";
          break;
        case "5": // WATCHDOG_NOTICE
          v = "notice";
          break;
        case "6": // WATCHDOG_INFO
          v = "info";
          break;
        case "7": // WATCHDOG_DEBUG
          v = "debug";
          break;
        default: // 0 ~ WATCHDOG_EMERGENCY
          v = "emergency";
      }
      o.severity = v;
      // Set other properties.
      o.time = Judy.dateTime(new Date(o.timestamp * 1000));
      if (!o.uid || o.uid === "0") {
        o.uid = 0;
        o.name = self.local("anonymous_user");
      }
      _.logs[ "_" + o.wid ] = o;
    }
    // Render.
    s = '<table class="sticky-enabled"><thead><tr>' +
      '<th>' + Drupal.t('Severity') + '</th>' +
      '<th>' + Drupal.t('Type') + '</th>' +
      '<th>' + Drupal.t('Time') + '</th>' +
      '<th>' + Drupal.t('User') + '</th>' +
      '<th>' + Drupal.t('Message') + '</th>' +
      '</tr></thead><tbody>';
    for(i = 0; i < le; i++) {
      o = logs[i];
      s += '<tr id="log_filter_list_log_' + o.wid + '" class="' + (i % 2 ? 'even' : 'odd') +
          '" onclick="LogFilter.displayLog(\'_' + o.wid + '\');" title="' + self.local("log_display", { '!number': o.wid }) + '">' +
        '<td class="' + css + '-severity ' + css + '-' + (v = o.severity) + '" title="' + self.local(v) + '">&#160;</td>' +
        '<td class="' + css + '-type">' + o.type + '</td>' +
        '<td class="' + css + '-time">' + o.time + '</td>' +
        '<td class="' + css + '-user">' +
          (!o.uid ? o.name : ('<a href="/user/' + o.uid + '" title="' + self.local('log_user') + ' ' + o.uid + '">' + o.name + '</a>')) + '</td>' +

        // @todo: optionally list hostname|location|referer

        '<td class="' + css + '-message"><div>' +
          Judy.stripTags(o.message.replace(/\r?\n/g, " ")).substr(0, _.listMessageTruncate) + '</div></td>' +
        '</tr>';
    }
    s += "</tbody></table>";
    $("#log_filter_log_list").html(s);
    // Apply Drupal tableheader.
    setTimeout(function() {
      $('#log_filter_log_list table.sticky-enabled').once('tableheader', function () {
        $(this).data("drupal-tableheader", new Drupal.tableHeader(this));
      });
    }, 100);
  };

  /**
   * @ignore
   * @param {string} action
   * @param {object} oData
   * @return {void}
   */
  _ajaxRequest = function(action, oData) {
    oData.form_token = Judy.fieldValue("[name='form_token']", _elements.form);
    $.ajax({
      url: "/log_filter/ajax/" + action,
      type: "POST",
      data: oData,
      dataType: "json", // expects json formatted response data
      cache: false,
      /**
        * @return {void}
        * @param {obj} oResp
        *  - (string) action
        *  - (bool) success
        *  - (string) error
        *  - (integer) error_code
        * @param {str} textStatus
        * @param {obj} jqXHR
        */
      success: function(oResp, textStatus, jqXHR) {
        var o;
        if(textStatus === "success" && typeof action === "string" && $.type(oResp) === "object") {
          _ajaxResponse(action, oResp);
        }
        else {
          o = {
            source: "ajax request",
            action: action,
            textStatus: textStatus,
            oResp: oResp
          };
          _.errors.push(o);
          _errorHandler(null, o, _name + "._ajaxRequest()");
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        var o;
        if(jqXHR && jqXHR.status === 403) {
          _ajaxResponse(action, { success: false, error_code: _errorCodes.perm_general });
        }
        else {
          o = {
            source: "ajax request",
            action: action,
            textStatus: textStatus,
            errorThrown: errorThrown
          };
          _.errors.push(o);
          _errorHandler(null, o, _name + "._ajaxRequest()");
        }
      }
    });
  };
  /**
   * @ignore
   * @param {string} action
   * @param {object} oResp
   * @return {void}
   */
  _ajaxResponse = function(action, oResp) {
    var errorCode = oResp.error_code || 0, url;
    //  Handle general errors.
    if (!oResp.success || errorCode) {
      switch(errorCode) {
        //  General errors.
        case _errorCodes.perm_general: // Probably session timeout.
          //  Reload page, to get 403. And remove form.
          $(_elements.form).html("");
          self.Message.set( self.local("error_form_expired", { "!url": url = _url() }), "warning", { // In case Javascript redirect fails.
              modal: true,
              close: function() {
                window.location.href = url;
              }
          });
          return;
        case _errorCodes.form_expired:
          self.Message.set( self.local("error_form_expired", { "!url": url = _url() }), "warning", {
              modal: true,
              close: function() {
                window.location.href = url;
              }
          });
          return;
        //  Errors by more than one request type.
        case _errorCodes.error_perm_filter_crud:
          self.Message.set( self.local("error_perm_filter_crud"), "warning", {
              modal: true,
              close: function() {
                window.location.href = _url(); // Reload to make GUI reflect permissions; omitting create/edit/save/delete controls.
              }
          });
          return;
        case _errorCodes.db_general: // Database error.
          self.Message.set( self.local("error_db_general"), "error", {
              modal: true,
              close: function() {
                window.location.href = _url();
              }
          });
          break;
        // default: Let action function handle the error, and optionally return false if it doesnt know that error code.
      }
    }
    if(_ajaxResponse.hasOwnProperty(action)) { // IE<9 wont like that, has no function.hasOwnProperty() method ;-)
      if(!_ajaxResponse[action](oResp)) {
        _errorHandler(null, oResp, _name + "._ajaxResponse." + action + "()");
        self.Message.set( self.local("error_unknown"), "error", {
            modal: true,
            close: function() {
              window.location.href = _url();
            }
        });
      }
    }
    else {
      _errorHandler(null, oResp, _name + "._ajaxResponse(), unsupported action[" + action + "]");
    }
  };
  /**
   * @ignore
   * @param {object} oResp
   * @return {boolean}
   */
  _ajaxResponse.filter_create = function(oResp) { // Only saves a default filter with a name; progress to edit mode on success.
    var nm = oResp.name;
    if(oResp.success) {
      _elements.filter.name_suggest.value = "";
      _elements.filter.origin.value = _.origin = _.name;
      _elements.filter.name.value = _.name = nm;
      _filters.push(nm);
      _setMode("edit");
      $(_elements.misc.title).html(nm + "<span> - " + oResp.description + "</span>");
      Judy.overlay(0);
      self.Message.set(self.local("savedNew", {"!filter": nm}));
    }
    else {
      switch(oResp.error_code) {
        case _errorCodes.filter_name_composition: // Invalid machine name.
          Judy.overlay(0);
          self.Message.set( self.local("error_machine_name_composition"), "warning", {
              modal: true,
              close: function() {
                Judy.focus(_elements.filter.name_suggest);
              }
          });
          break;
        case _errorCodes.filter_name_nonunique: // Filter name already exists.
          Judy.overlay(0);
          self.Message.set( self.local("error_filter_name_nonunique", {"!name": nm}), "warning", {
              modal: true,
              close: function() {
                Judy.focus(_elements.filter.name_suggest);
              }
          });
          break;
        default: // Unknown error code.
          return false;
      }
    }
    _ajaxRequestingBlocking = false;
    return true;
  };
  /**
   * @ignore
   * @param {object} oResp
   * @return {boolean}
   */
  _ajaxResponse.filter_edit = function(oResp) {
    var nm = oResp.name;
    if(oResp.success) {
      $("span", _elements.misc.title).html(" - " + oResp.description);
      Judy.overlay(0);
      self.Message.set(self.local("saved", {"!filter": nm}));
    }
    else if(oResp.error_code === _errorCodes.filter_doesnt_exist) {
      self.Message.set( self.local("error_filter_doesnt_exist", {"!name": nm}), "warning", {
          modal: true,
          close: function() {
            window.location.href = _url(); // Reload to make GUI reflect missing filter.
          }
      });
    }
    else if(oResp.error_code === _errorCodes.perm_filter_restricted) {
      self.Message.set( self.local("error_perm_filter_restricted"), "error", {
          modal: true,
          close: function() {
            window.location.href = _url(); // Reload to make get out of that situation.
          }
      });
    }
    else {
      return false;
    }
    _ajaxRequestingBlocking = false;
    return true;
  };
  /**
   * @ignore
   * @param {object} oResp
   * @return {boolean}
   */
  _ajaxResponse.list_logs = function(oResp) {
    var nm = oResp.name;
    if(oResp.success) {
      _listLogs(oResp.log_list[0], oResp.log_list[1]);
      //  Deleting logs is allowed when evenever the log list reflects the filter.
      if(_.delLogs) {
        Judy.enable(_elements.buttons.delete_logs_button, null, "");
      }
      Judy.overlay(0);
    }
    else {
      return false;
    }
    _ajaxRequestingBlocking = false;
    return true;
  };
  /**
   * @ignore
   * @param {object} oResp
   * @return {boolean}
   */
  _ajaxResponse.delete_logs = function(oResp) {
    if(oResp.success) {
      self.Message.set(self.local("deleteLogs_success", { "!number": oResp.delete_logs }), "notice");
      _getLogList();
      return true;
    }
    else {
      return false;
    }
  };

  /**
   * Does nothing if no Inspect module (or no-action version of Inspect; user not allowed to use frontend instection).
   *
   * @function
   * @name LogFilter.inspect
   * @param {string|falsy} [prop]
   * @return {void}
   */
  this.inspect = function(prop) {
    if(typeof window.inspect === "function" && inspect.tcepsni === true) {
      inspect(!prop ? _ : _[prop], _name + (!prop ? "" : (" - " + prop)));
    }
  };
  /**
   * @function
   * @name LogFilter.inspectElements
   * @param {string|falsy} [group]
   * @return {void}
   */
  this.inspectElements = function(group) {
    if(typeof window.inspect === "function" && inspect.tcepsni === true) {
      inspect(!group ? _elements : _elements[group], "_elements" + (!group ? "" : ("." + group)));
    }
  };
  /**
   * @function
   * @name LogFilter.inspectCriteria
   * @param {string|falsy} [group]
   * @return {void}
   */
  this.inspectCriteria = function(group) {
    if(typeof window.inspect === "function" && inspect.tcepsni === true) {
      inspect(_getCriteria());
    }
  };
  /**
   * Caches translated labels/message having no replacers.
   *
   * @function
   * @name LogFilter.local
   * @param {string} name
   * @param {object|falsy} [replacers]
   * @return {string}
   */
  this.local = function(name, replacers) {
    var nm = name, s;
    //  S.... Drupal.t() doesnt use the 'g' flag when replace()'ing, so Drupal.t() replacement is utterly useless - and nowhere to report the bug :-(
    if(!(s = _oGet(_local, nm))) {
      switch(nm) {
        case "default":
          _local[nm] = s = Drupal.t("Default");
          break;
        case "adhoc":
          _local[nm] = s = Drupal.t("Ad hoc");
          break;
        case "adhocForOrigin":
          //  {"!origin": nm}
          s = Drupal.t("Ad hoc - based on !origin", replacers );
          break;
        case "newForOrigin":
          //  {"!origin": nm}
          s = Drupal.t("New - based on !origin", replacers );
          break;
        case "newTitle":
          _local[nm] = s = Drupal.t("New");
          break;
        case "newName":
          _local[nm] = s = Drupal.t("new");
          break;
        case "savedNew":
          //  { "!filter": name }
          s = Drupal.t("Saved new filter '!filter'.", replacers);
          break;
        case "saved":
          //  { "!filter": name }
          s = Drupal.t("Saved filter '!filter'.", replacers);
          break;
        case "confirmDelete":
          //  { "!filter": _elements.filter.name.value }
          s = Drupal.t("Are you sure you want to delete the filter!newline!filter?", replacers);
          break;
        case "invalid_date":
          //  {"!date": v, "!format": _.dateFormat}
          s = Drupal.t("The date '!date' is not valid!newline- please use the format: !format", replacers);
          break;
        case "invalid_timeSequence_from":
          _local[nm] = s = Drupal.t("'From' time cannot be later than 'To' time.");
          break;
        case "invalid_timeSequence_to":
          _local[nm] = s = Drupal.t("'To' time cannot be earlier than 'From' time.");
          break;
        case "invalid_uid":
          _local[nm] = s = Drupal.t("User ID must be a positive number, or empty.");
          break;
        case "invalid_location":
          _local[nm] = s = Drupal.t("Requested URL must be a URL, or empty.");
          break;
        case "invalid_referer":
          _local[nm] = s = Drupal.t("Referrer URL must be a URL, 'none', or empty.");
          break;
        case "error_machine_name_composition":
          //  { "!illegals": "default, adhoc" }
          s = Drupal.t("The filter name:!newline- must be 2 to 32 characters long!newline- must only consist of the characters a-z, letters, and underscore (_)!newline- cannot start with a number!newline- cannot be: !illegals", replacers);
          break;
        case "error_filter_name_nonunique":
          //  {"!name": name}
          s = Drupal.t("There's already a filter named!newline'!name'.", replacers);
          break;
        case "error_filter_doesnt_exist":
          //  {"!name": name}
          s = Drupal.t("There's no filter named!newline'!name'.", replacers);
          break;
        case "wait":
          _local[nm] = s = Drupal.t("Please wait a sec...");
          break;
        case "wait_create":
          _local[nm] = s = Drupal.t("Creating new filter. Please wait a sec...");
          break;
        case "wait_ereate":
          _local[nm] = s = Drupal.t("Saving filter changes. Please wait a sec...");
          break;
        case "deleteLogs_prohibit":
          _local[nm] = s = Drupal.t("Only allowed when the log list is freshly updated,!newlinereflecting current filter - press the 'Update list' button.");
          break;
        case "deleteLogs_all":
          _local[nm] = s = Drupal.t("Do you want to delete!newlineALL logs?");
          break;
        case "deleteLogs_noConditions":
          //  {"!number": integer}
          s = Drupal.t("Do you want to delete logs!newlinewithout ANY condition!newlineexcept limited by a maximum of !number?", replacers);
          break;
        case "deleteLogs_storedNoMax":
          //  {"!name": name}
          s = Drupal.t("Do you want to delete all logs matching!newlinethe '!name' filter!newlinelimited by NO maximum?", replacers);
          break;
        case "deleteLogs_stored":
          //  {"!name": name, "!number": integer}
          s = Drupal.t("Do you want to delete all logs matching!newlinethe '!name' filter!newlinelimited by a maximum of !number?", replacers);
          break;
        case "deleteLogs_adhocNoMax":
          _local[nm] = s = Drupal.t("Do you want to delete all logs!newlinematching current ad hoc filter!newlinelimited by NO maximum?", replacers);
          break;
        case "deleteLogs_adhoc":
          //  {"!number": integer}
          s = Drupal.t("Do you want to delete all logs!newlinematching current ad hoc filter!newlinelimited by a maximum of !number?", replacers);
          break;
        case "deleteLogs_success":
          //  {"!number": integer}
          s = Drupal.t("Deleted !number log events.", replacers);
          break;
        case "error_form_expired":
          //  {"!url": url}
          s = Drupal.t("The form has become outdated!newline- please <a href=\"!url\">reload this page</a>.", replacers);
          break;
        case "error_perm_filter_crud":
          _local[nm] = s = Drupal.t("Sorry, you're not allowed to edit saveable filters.");
          break;
        case "error_perm_filter_restricted":
          _local[nm] = s = Drupal.t("You're not allowed to use that filter.");
          break;
        case "error_db_general":
          _local[nm] = s = Drupal.t("Sorry, failed to save data.");
          break;
        case "error_unknown":
          _local[nm] = s = Drupal.t("Sorry, something unexpected happened.");
          break;
        case "emergency":
          _local[nm] = s = Drupal.t("Emergency");
          break;
        case "alert":
          _local[nm] = s = Drupal.t("Alert");
          break;
        case "critical":
          _local[nm] = s = Drupal.t("Critical");
          break;
        case "error":
          _local[nm] = s = Drupal.t("Error");
          break;
        case "warning":
          _local[nm] = s = Drupal.t("Warning");
          break;
        case "notice":
          _local[nm] = s = Drupal.t("Notice");
          break;
        case "info":
          _local[nm] = s = Drupal.t("Info");
          break;
        case "debug":
          _local[nm] = s = Drupal.t("Debug");
          break;
        case "anonymous_user":
          _local[nm] = s = Drupal.t("anonymous");
          break;
        case "log_display":
          //  {"!number": integer}
          s = Drupal.t("Event !number", replacers);
          break;
        case "log_event":
          _local[nm] = s = Drupal.t("Event");
          break;
        case "log_severity":
          _local[nm] = s = Drupal.t("Severity");
          break;
        case "log_type":
          _local[nm] = s = Drupal.t("Type");
          break;
        case "log_time":
          _local[nm] = s = Drupal.t("Time");
          break;
        case "log_user":
          _local[nm] = s = Drupal.t("User");
          break;
        case "log_location":
          _local[nm] = s = Drupal.t("Location");
          break;
        case "log_referer":
          _local[nm] = s = Drupal.t("Referrer");
          break;
        case "log_hostname":
          _local[nm] = s = Drupal.t("Hostname");
          break;
        case "log_message":
          _local[nm] = s = Drupal.t("Message");
          break;
        case "log_link":
          _local[nm] = s = Drupal.t("Link");
          break;
        default:
          s = "[LOCAL: " + nm + "]";
      }
    }
    return s.replace(/\!newline/g, "\n");
  };

  /**
   * Singleton, instantiated to itself.
   * @constructor
   * @namespace
   * @name LogFilter.Message
   * @singleton
   */
  this.Message = function() {
    var _self = this,
    _n = -1,
    _msie = $.browser.msie,
    _htmlList = "<div id=\"log_filter__message\"><div><div id=\"log_filter__message_list\"></div></div></div>",
    _htmlItem = "<div id=\"log_filter__message___NO__\" class=\"log-filter-message-__TYPE__\"><div class=\"log-filter--message-content\"><span>__CONTENT__</span></div><div title=\"" +
        Drupal.t("Close") + "\">x</div></div>",
    _list,
    _faders = {},
    /**
    * @function
    * @name LogFilter.Message._close
    * @return {void}
    */
    _close = function() {
      $(this.parentNode).hide();
    },
    /**
    * Message item fader.
    *
    * Not prototypal because the 'this' of prototypal methods as event handlers is masked by jQuery's element 'this' (or for inline handlers the global window 'this').
    * Could use prototypal methods if we passed the the 'this' of the fader to jQuery handlers, but that would result in lots of references to the fader object (and probably more overall overhead).
    *
    * @constructor
    * @class
    * @name LogFilter.Message._fader
    * @param {string} selector
    * @param {integer|float|falsy} [delay]
    *  - default: 3000 (milliseconds)
    *  - if less than 1000 it will be used as multiplier against the default delay
    */
    _fader = function(selector, delay) {
      var __self = this,
      /**
      * Default delay.
      *
      * @name LogFilter.Message._fader#_delayDefault
      * @type integer
      */
      _delayDefault = 3000,
      /**
      * Interval setting.
      *
      * @name LogFilter.Message._fader#_pause
      * @type integer
      */
      _pause = 150, // Milliseconds.
      /**
      * Opacity decrease factor setting.
      *
      * @name LogFilter.Message._fader#_factor
      * @type float
      */
      _factor = 1.2,
      /**
      * State.
      *
      * @name LogFilter.Message._fader#_stopped
      * @type boolean
      */
      _stopped,
      /**
      * @name LogFilter.Message._fader#_opacity
      * @type integer
      */
      _opacity = 100,
      /**
      * @name LogFilter.Message._fader#_subtractor
      * @type integer
      */
      _subtractor = 1,
      /**
      * @function
      * @name LogFilter.Message._fader#_start
      * @return {void}
      */
      _start = function() {
        /** @ignore */
        __self._interval = setInterval(_fade, _pause)
      },
      /**
      * @function
      * @name LogFilter.Message._fader#_fade
      * @return {void}
      */
      _fade = function() {
        var n = _opacity, jq = __self._jq;
        if(!_stopped) {
          if((_opacity = (n -= (_subtractor *= _factor))) > 0) {
            if(!_msie) {
              jq.css("opacity", n / 100);
            }
            else {
              jq.css({
                "-ms-filter": "progid:DXImageTransform.Microsoft.Alpha(Opacity=" + (n = Math.round(n)) + ")",
                filter: "alpha(opacity=" + n + ")"
              });
            }
          }
          else {
            _stopped = true;
            clearInterval(__self._interval);
            jq.hide();
          }
        }
      },
      /** @ignore */
      jq;
      /**
      * @function
      * @name LogFilter.Message._fader#stop
      * @return {void}
      */
      this.stop = function() {
        if(!_stopped) {
          _stopped = true;
          clearTimeout(__self._timeout);
          clearInterval(__self._interval);
        }
      };
      /**
      * @function
      * @name LogFilter.Message._fader#unfade
      * @return {void}
      */
      this.unfade = function() {
        __self.stop();
        if(_opacity < 100) {
          if(!_msie) {
            __self._jq.css("opacity", 1);
          }
          else {
            __self._jq.css({
              "-ms-filter": "progid:DXImageTransform.Microsoft.Alpha(Opacity=100)",
              filter: "alpha(opacity=100)"
            });
          }
        }
      };
      /**
      * @function
      * @name LogFilter.Message._fader#destroy
      * @return {void}
      */
      this.destroy = function() {
        __self.stop();
        delete __self._jq;
      };
      //  Construction logics.
      if((jq = $(selector)).get(0)) {
        /**
        * @name LogFilter.Message._fader#_jq
        * @type jquery
        */
        this._jq = jq;
        /** @ignore */
        this._timeout = setTimeout(
            _start,
            !delay ? _delayDefault : (delay < 1000 ? Math.floor(delay * _delayDefault) : _delayDefault)
        );
      }
    };
    /**
    * @function
    * @name LogFilter.Message.setup
    * @return {void}
    */
    this.setup = function() {
      var elm, jq;
      if((elm = document.getElementById("console"))) {
        $(elm).after(_htmlList);
      }
      else {
        $("#content").prepend(_htmlList);
      }
      _list = document.getElementById("log_filter__message_list");
      //  Draggable.
      if((jq = $(_list)).draggable) {
        jq.draggable({ handle: "div.log-filter--message-content", cancel: "span", cursor: "move" });
      }
    };
    /**
    * @function
    * @name LogFilter.Message.set
    * @param {mixed} txt
    * @param {string} [type]
    *  - default: 'status'
    *  - values: 'status' | 'info' |  'notice' |  'warning' | 'error'
    * @param {object} [options]
    *  - (boolean) noFade: default false ~ a 'status' or 'info' message will eventually fade away, unless clicked/mousedowned
    *  - (number) fadeDelay: default zero ~ use default delay before starting fade ('status' message only)
    *  - (number) fadeDelay: >1000 ~ use that delay | < 1000 multiply default delay with that number (both 'status' message only)
    *  - (boolean) modal: default false ~ do not display blocking overlay
    *  - (function) close: function to execute upon click on close button
    * @param {integer} [delay]
    *  - default: 4000 (milliseconds)
    * @return {void}
    */
    this.set = function(txt, type, options) {
      var t = type || "status", s, f, k, jq, o = {
        noFade: true,
        fadeDelay: 0,
        modal: false,
        close: null
      };
      switch(t) {
        case "status":
        case "info":
          o.noFade = false;
          break;
        case "notice":
        case "warning":
          break;
        default:
          t = "error";
      }
      if(options) {
        for(k in o) {
          if(o.hasOwnProperty(k) && options.hasOwnProperty(k)) {
            o[k] = options[k];
          }
        }
      }
      //  Add message to DOM.
      $(_list).prepend(
        _htmlItem.replace(/__NO__/, ++_n).replace(/__TYPE__/, t).replace(/__CONTENT__/, txt ? txt.replace(/\n/g, "<br/>") : "")
      );
      //  Close behaviours.
      (jq = $((s = "#log_filter__message_" + _n) + " > div:last-child")).click(_close);
      //  If modal, show overlay.
      if(o.modal) {
        jq.click(Judy.overlay); // And hide it on close click.
        Judy.overlay(1, true); // Opaque, no hover title.
      }
      //  Close function.
      if(o.close) {
        jq.click(o.close);
      }
      //  If to be fading, make click on message content unfade the message.
      if(!o.noFade) {
        _faders[ "_" + _n ] = f = new _fader(s, o.fadeDelay);
        $(s + " > div:first-child").bind("click mousedown", f.unfade); // And mousedown, otherwise dragging wont prevent fade.
      }
      //  Display the message.
      $(s).show();
    };
    /**
    * @function
    * @name LogFilter.Message.showAll
    * @return {void}
    */
    this.showAll = function() {
      var le = _n + 1, i, f;
      for(i = 0; i < le; i++) {
        if((f = _faders[ "_" + i ]) && _faders.hasOwnProperty("_" + i)) {
          f.unfade();
        }
        $("#log_filter__message_" + i).show();
      }
    };
  };

  /**
   * @param {string} logId
   * @return {void}
   */
  this.displayLog = function(logId) {
    var o, s, v, css = 'log-filter-log-display', dialId = 'log_filter_logDisplay' + logId, elm, $dialOuter;
    if ((o = _.logs[logId]) && _.logs.hasOwnProperty(logId)) {
      // If already open: close the dialog.
      if ((elm = document.getElementById(dialId))) {
        $('#log_filter_list_log' + logId).removeClass('log-filter-list-displayed');
        Judy.dialog(dialId, "close");
      }
      else {
        $('#log_filter_list_log' + logId).addClass('log-filter-list-displayed');
        o = _.logs[logId];
        s = '<div class="' + css + '">' +
            '<table class="dblog-event"><tbody>' +
            '<tr class="odd"><th>' + self.local('log_severity') + '</th>' +
              '<td>' + (v = o.severity) + '<div class="' + css + '-severity ' + css + '-' + v + '">&#160;</div></td></tr>' +
            '<tr class="even"><th>' + self.local('log_type') + '</th><td>' + o.type + '</td></tr>' +
            '<tr class="odd"><th>' + self.local('log_time') + '</th><td>' + o.time + '</td></tr>' +
            '<tr class="even"><th>' + self.local('log_user') + '</th>' +
              '<td>' + (!o.uid ? o.name : ('<a href="/user/' + o.uid + '" title="' + o.uid + '">(' + o.uid + ') ' + o.name + '</a>')) +
              ' &#160; &bull; &#160; ' + self.local('log_hostname') + ': ' + o.hostname + '</td></tr>' +
            '<tr class="odd"><th>' + self.local('log_location') + '</th><td><a href="' + o.location + '">' + o.location + '</a></td></tr>' +
            '<tr class="even"><th>' + self.local('log_referer') + '</th>' +
              '<td>' + (!o.referer ? '&#160;' : ('<a href="' + o.referer + '">' + o.referer + '</a>')) + '</td></tr>' +
            '<tr class="odd"><th>' + self.local('log_message') + '</th><td>' + o.message + '</td></tr>' +
            (!o.link ? '' : ('<tr class="even"><th>' + self.local('log_link') + '</th><td><a href="' + o.link + '">' + o.link + '</a></td></tr>')) +
            '</tbody></table>' +
          '</div>';
        Judy.dialog(dialId, {
          title: self.local('log_event') + ': ' + o.wid,
          content: s,
          fixed: true,
          resizable: false,
          closeOnEscape: false, // Only works when the dialog has focus; we set general handler in .setup().
          dialogClass: "log-filter-log-display-dialog",
          contentClass: "log-filter-log-display-content",
          autoOpen: false,
          close: function(event, ui) {
            setTimeout(function() {
              $('#log_filter_logDisplay' + logId).dialog('destroy').remove();
              $('#log_filter_list_log' + logId).removeClass('log-filter-list-displayed');
            });
          }
        });
        ($dialOuter = $( $('#' + dialId).get(0).parentNode )).css({
          visibility: 'hidden',
          overflow: 'visible'
        });
        Judy.dialog(dialId, "open");
        Judy.outerWidth($dialOuter, true, Judy.innerWidth(window) - 200, 2);
        Judy.outerHeight('#' + dialId, true,
          Judy.outerHeight($dialOuter, true, Judy.outerHeight(window) - 10, 1) -
            Judy.outerHeight($('div.ui-dialog-titlebar', $dialOuter)) -
            Math.ceil(parseFloat($dialOuter.css("padding-top")) + parseFloat($dialOuter.css("padding-bottom"))),
          1
        );
        $dialOuter.css({
          visibility: 'visible',
          left: '150px', // jQuery UI dialog position apparantly doesnt work well when css position is fixed.
          top: '4px'
        });
      }
    }
  };

  /**
   * Called before page load.
   *
   * @function
   * @name LogFilter.init
   * @param {bool|integer} useModuleCss
   * @param {string} theme
   * @return {void}
   */
  this.init = function(useModuleCss, theme) {
    /** @ignore */
    self.init = function() {};
    //  Tell styles about theme.
    if((_.useModuleCss = useModuleCss)) {
      $("div#page").addClass("theme-" + theme);
    }
    //	Set overlay, to prevent user from doing anything before page load and after form submission.
    Judy.overlay(1, false, self.local("wait"));
  };
  /**
   * Called upon page load.
   *
   * @function
   * @name LogFilter.setup
   * @param {object} [filters]
   * @param {array} [messages]
   * @return {void}
   */
  this.setup = function(filters, messages) {
    var a = messages, le, i, o = { fadeDelay: 2 }; // Long (double) delay when at page load.
    /** @ignore */
    self.setup = function() {};
    _filters = filters || [];
    _prepareForm();
    _setMode(_.mode, false, true);

    _resize(null, true); // Hides overlay.

    //  Display messages, if any.
    (self.Message = new self.Message()).setup();
    if(a) {
      le = a.length;
      //  Check if any message isnt of type status; status message should fade, unless there's another message of a different (more urgent) type.
      for(i = 0; i < le; i++) {
        if(a[i][1] && a[i][1] !== "status") {
          o.noFade = true;
          break;
        }
      }
      for(i = 0; i < le; i++) {
        self.Message.set(a[i][0], a[i][1], o);
      }
    }

    //  Prepare log list.
    _getLogList();

    // Make all event dialogs close on escape, and no matter what has focus.
    Judy.keydown(document.documentElement, "escape", function() {
      $('div.log-filter-log-display-content').each(function() {
        $(this).dialog("close");
      });
    });
  };
}
window.LogFilter = new LogFilter($);

/*
Drupal.behaviors.logFilterLogListTableHeader = {
  attach: function (context) {
    if (!$.support.positionFixed) {
      return;
    }

    $('table.sticky-enabled', context).live('tableheader', function () {
      $(this).data("drupal-tableheader", new Drupal.tableHeader(this));
    });
  }
};
*/

})(jQuery);
