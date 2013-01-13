/**
 * @file
 *  Drupal Log Filter module
 */

(function($) {

/**
 * Singleton, instantiated to itself.
 * @constructor
 * @name LogFilter
 * @singleton
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
  _ = {
    //  {arr}
    errors: [],
    dateFormat: "YYYY-MM-DD",
    dateFormat_datepicker: "yy-mm-dd",
    mode: "default", // default | adhoc | stored | create | edit | delete
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
    }
  },
  /**
   * @private
   * @type {str}
   */
  _basePath = "/",
  /**
   * @private
   * @type {bool}
   */
  _secure,
  /**
   * @private
   * @type {jquery|undefined}
   */
  _jqOverlay,
  /**
   * @private
   * @type {bool|undefined}
   */
  _submitted,/**
   * @private
   * @type {bool|undefined}
   */
  _ajaxRequestingBlocking,
  /**
   * List of previously used localized labels/messages.
   *
   * @private
   * @type {object}
   */
  _local = {

  },
  /**
   * @private
   * @type {obj}
   */
  _selectors = {
    settings: {
      mode: "input[name='log_filter_mode']",
      onlyOwn: "input[name='log_filter_only_own']",
      delete_logs_max: "input[name='log_filter_delete_logs_max']", // May not exist.
      cache: "input[name='log_filter_cache']"
    },
    filter: {
      filter: "select[name='log_filter_filter']",
      name: "input[name='log_filter_name']", // Hidden.
      origin: "input[name='log_filter_origin']", // Hidden.
      name_suggest: "input[name='log_filter_name_suggest']",
      description: "textarea[name='log_filter_description']",
      require_admin: "input[name='log_filter_require_admin']", // May not exist.
      delete_logs: "input[name='log_filter_delete_logs']" // May not exist.
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
      type_some: "textarea[name='log_filter_type']", // Single element.
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
      submit: "input#edit-submit", // Not part of filter dialog.
      reset: "input[name='log_filter_reset']", // Not part of filter dialog.
      create: "input[name='log_filter_create']",
      set_name: "input[name='log_filter_set_name']",
      edit: "input[name='log_filter_edit']",
      del: "input[name='log_filter_delete']",
      cancel: "input[name='log_filter_cancel']",
      save: "input[name='log_filter_save']",
      delete_by_filter: "input[name='log_filter_delete_by_filter']"
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
      crudFilters: [] // create, edit, del, cancel, save.
    },
    misc: {}
  },
  _initialTypes = "",
  _filters = [],

  //  Declare private methods, to make IDEs list them
  _errorHandler, _oGet, _toLeading, _toAscii, _innerWidth, _innerHeight, _dateFromFormat,
  _selectValue, _textareaRemoveWrapper, _disable, _enable, _readOnly, _readWrite,
  _machineNameConvert, _machineNameValidate,
  _resize, _overlayResize, _overlayDisplay,
  _submit, _prepareForm, _setMode, _crudRelay, _changedCriterion, _resetCriteria, _getCriteria, _deleteLogs,
  _ajaxResponse, _ajaxRequest;
  /**
   * @ignore
   * @private
   * @param {Error} [er]
   * @param {string} [ms]
   * @return {str}
   */
  _errorHandler = function(er, ms) {
    var s = (!ms ? "" : (ms + ":\n")) + (!er ? "" : inspect.traceGet(er));
    inspect.console(s);
    inspect.log(s, {
      category: "log_filter",
      message: s,
      severity: "error"
    });
  };
  /**
   * Object/function property getter, Object.hasOwnproperty() alternative.
   *
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
  /**
   * Prepends zeroes until arg length length.
   *
   * @param {string|integer} u
   * @param {integer} [length]
   *  - default: 1
   * @return {string}
   */
  _toLeading = function(u, length) {
    var le = length || 1, s = "" + u;
    while(s.length < le) {
      s = "0" + s;
    }
    return s;
  };
  _toAscii = function(s) {
    var ndl = _toAscii.needles, rpl = _toAscii.replacers, le = ndl.length, i, u;
    if(typeof ndl[0] === "string") { // First time called.
      u = ndl.concat();
      for(i = 0; i < le; i++) {
          ndl[i] = new RegExp("\\u" + _toLeading(u[i].charCodeAt(0).toString(16), 4), "g");
      }
    }
    for(i = 0; i < le; i++) {
        s = s.replace(ndl[i], rpl[i]);
    }
    return s;
  };
  /**
	 * Nicked from Judy.
	 */
	_innerWidth = function(elm, disregardPadding) {
		var dE = document.documentElement, jq, d, p;
		if(elm === window) {
			return dE.clientWidth;
		}
		if(elm === dE || elm === document.body) {
			return dE.scrollWidth;
		}
		if(!(jq = $(elm)).get(0)) {
			return undefined;
		}
		d = jq.innerWidth();
		if(!disregardPadding) {
			if((p = jq.css("padding-left")).indexOf("px") > -1) {
				d -= parseInt(p, 10);
			}
			if((p = jq.css("padding-right")).indexOf("px") > -1) {
				d -= parseInt(p, 10);
			}
		}
		return d;
	};
	/**
	 * Nicked from Judy.
	 */
	_innerHeight = function(elm, disregardPadding) {
		var dE = document.documentElement, jq, d, p;
		if(elm === window) {
			return dE.clientHeight;
		}
		if(elm === dE || elm === document.body) {
			return dE.scrollHeight;
		}
		if(!(jq = $(elm)).get(0)) {
			return undefined;
		}
		d = jq.innerHeight();
		if(!disregardPadding) {
			if((p = jq.css("padding-top")).indexOf("px") > -1) {
				d -= parseInt(p, 10);
			}
			if((p = jq.css("padding-bottom")).indexOf("px") > -1) {
				d -= parseInt(p, 10);
			}
		}
		return d;
	};
  /**
   * Translate string - like the value of a text field - to Date.
   *
   * Supported formats, dot means any (non-YMD) character:
   * - YYYY.MM.DD
   * - MM.DD.YYYY
   * - DD.MM.YYYY
   *
   * No support for hours etc.
   * @function
   * @name judy.dateFromFormat
   * @param {str} s
   * @param {str} [format]
   *  - default: YYYY-MM-DD
   *  - delimiters are ignored, only looks for the position of YYYY, MM and DD in the format string
   * @return {Date|null}
   *  - null if arg str isnt non-empty string, or impossible month or day, or unsupported format
   */
  _dateFromFormat = function(s, format) {
    var dt = new Date(), fmt = (format || "YYYY-MM-DD").toUpperCase(), y, m, d;
    if(!s || typeof s !== "string" || !s.length) {
      return null;
    }
    if(/^YYYY.MM.DD$/.test(fmt)) { // iso
      if(!/^\d{4}.\d\d.\d\d$/.test(s)) {
        return null;
      }
      y = s.substr(0, 4);
      m = s.substr(5, 2);
      d = s.substr(8, 2);
    }
    else if(/^MM.DD.YYYY$/.test(fmt)) { // English
      if(!/^\d\d.\d\d.\d{4}$/.test(s)) {
        return null;
      }
      y = s.substr(6, 4);
      m = s.substr(0, 2);
      d = s.substr(3, 2);
    }
    else if(/^DD.MM.YYYY$/.test(fmt)) { // continental
      if(!/^\d\d.\d\d.\d{4}$/.test(s)) {
        return null;
      }
      y = s.substr(6, 4);
      m = s.substr(3, 2);
      d = s.substr(0, 2);
    }
    else {
      return null;
    }
    y = parseInt(y, 10);
    d = parseInt(d, 10);
    switch((m = parseInt(m, 10))) {
      case 1:
      case 3:
      case 5:
      case 7:
      case 8:
      case 10:
      case 12:
        if(d > 31) {
          return null;
        }
        break;
      case 4:
      case 6:
      case 9:
      case 11:
        if(d > 30) {
          return null;
        }
        break;
      case 2:
        if(d > 29 || (d === 29 && !self.isLeapYear(y))) {
          return null;
        }
        break;
      default:
        return null;
    }
    dt.setFullYear(y, m - 1, d );
    dt.setHours(0, 0, 1);
    dt.setMilliseconds(1);
    return dt;
  };
  /**
   * @param {element} elm
   * @param {string|undefined} [val]
   * @return {string|integer}
   */
  _selectValue = function(elm, val) {
    var multi, r, ndx = -1, rOpts, nOpts, nVals, i, vals = [], v, set = 0;
    //  get ------------------------------------
    if(val === undefined &&
        ((ndx = elm.selectedIndex) === undefined || ndx < 0)) {
      return "";
    }
    // getting and setting
    multi = elm.multiple;
    nOpts = (rOpts = $("option", elm).get()).length;
    //  get ----------------
    //  translating selectedIndex to actual option is weird/error prone, so we use jQuery list of options instead
    if(val === undefined) {
      if(!multi) {
        return (v = rOpts[ndx].value) !== "_none" ? v : "";
      }
      //  multi
      for(i = 0; i < nOpts; i++) {
        if((r = rOpts[i]).selected &&
            (v = r.value) !== "" && v !== "_none") {
          vals.push(v);
        }
      }
      return vals.length ? vals : "";
    }
    //  set ------------------------------------
    //  start by clearing all
    //  elm.selectedIndex = -1; ...is seriously unhealthy, may effectively ruin the select.
    for(i = 0; i < nOpts; i++) {
      rOpts[i].selected = false;
    }
    if(val === "" || val === "_none") {
      return true; // all done
    }
    //  secure array
    if(!$.isArray(val)) {
      v = ["" + val];
    }
    else {
      if(!(nVals = val.length) ||
          (nVals === 1 && (val[0] === "" || val[0] === "_none"))
      ) {
        return true; // all done
      }
      v = val.concat();
      for(i = 0; i < nVals; i++) { // stringify for comparison
        v[i] = "" + v[i];
      }
    }
    for(i = 0; i < nOpts; i++) {
      if( ( (r = rOpts[i]).selected = $.inArray(r.value, v) > -1 ? "selected" : false) ) { // set? and count
        ++set;
        if(!multi) {
          return 1;
        }
      }
    }
    return set;
  };
  /**
   * Removes parent form-textarea-wrapper div from (non-resizable) textarea, for easier (standard) DOM access.
   *
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
  /**
   * @param {element} elm
   * @param {string|falsy} [hoverTitle]
   *  - string: update the element's (hover) title attribute
   */
  _disable = function(elm, hoverTitle) {
    elm.disabled = "disabled";
    if(typeof hoverTitle === "string") {
      elm.setAttribute("title", hoverTitle);
    }
    if(elm.tagName.toLowerCase() === "input") {
      switch(elm.getAttribute("type")) {
        case "checkbox":
          $(elm).bind("click.LogFilter.disabled", function() {
            return false;
          });
          break;
        case "button":
        case "submit":
        case "reset":
          $(elm).addClass("form-button-disabled");
          break;
      }
    }
  };
  /**
   * @param {element} elm
   * @param {string|falsy} [hoverTitle]
   *  - string: update the element's (hover) title attribute
   */
  _enable = function(elm, hoverTitle) {
    elm.disabled = false;
    if(typeof hoverTitle === "string") {
      elm.setAttribute("title", hoverTitle);
    }
    if(elm.tagName.toLowerCase() === "input") {
      switch(elm.getAttribute("type")) {
        case "checkbox":
          $(elm).unbind("click.LogFilter.disabled");
          break;
        case "button":
        case "submit":
        case "reset":
          $(elm).removeClass("form-button-disabled");
          break;
      }
    }
  };
  /**
   * @param {element} elm
   * @param {string|falsy} [hoverTitle]
   *  - string: update the element's (hover) title attribute
   */
  _readOnly = function(elm, hoverTitle) {
    elm.readOnly = true;
    if(typeof hoverTitle === "string") {
      elm.setAttribute("title", hoverTitle);
    }
    switch(elm.tagName.toLowerCase()) {
      case "input":
        if(elm.getAttribute("type") === "checkbox") {
          $(elm).bind("click.readonly", function() {
            return false;
          });
        }
        break;
      case "select":
        $(elm).bind("focus.readonly", function(evt) {
          this.setAttribute("before_change_value", _selectValue(this));
          inspect(evt.type)
        }).bind("change.readonly", function() {
          _selectValue(this, this.getAttribute("before_change_value") || ""); // "" to prevent nasty undefined errors.
        });
        break;
    }
    $(elm).addClass("form-item-readonly");
  };
  /**
   * @param {element} elm
   * @param {string|falsy} [hoverTitle]
   *  - string: update the element's (hover) title attribute
   */
  _readWrite = function(elm, hoverTitle) {
    elm.readOnly = false;
    if(typeof hoverTitle === "string") {
      elm.setAttribute("title", hoverTitle);
    }
    switch(elm.tagName.toLowerCase()) {
      case "input":
        if(elm.getAttribute("type") === "checkbox") {
          $(elm).unbind("click.readonly");
        }
        break;
      case "select":
        $(elm).unbind("focus.readonly change.readonly");
        break;
    }
    $(elm).removeClass("form-item-readonly");
  };
  _toAscii.needles = [
    //  iso-8859-1
//JSLINT_IGNORE--- jslint unsafe chars, but _toAscii() starts out converting them to \uNNNN regexes.
    "Ä","Æ",
    "ä","æ",
    "Ö","Ø",
    "ö","ø",
    "Ü", "ü", "ß", "Å", "å",
    "À","Á","Â","Ã",
    "à","á","â","ã",
    "Ç", "ç", "Ð", "ð",
    "È","É","Ê","Ë",
    "è","é","ê","ë",
    "Ì","Í","Î","Ï",
    "ì","í","î","ï",
    "Ñ", "ñ",
    "Ò","Ó","Ô","Õ",
    "ò","ó","ô","õ",
    "Ù","Ú","Û",
    "ù","ú","û",
    "Ý",
    "ý","ÿ",
    "Þ", "þ"
//---JSLINT_IGNORE
  ];
  _toAscii.replacers = [
    //  iso-8859-1
    "Ae","Ae",
    "ae","ae",
    "Oe","Oe",
    "oe","oe",
    "Ue", "ue", "ss", "Aa", "aa",
    "A","A","A","A",
    "a","a","a","a",
    "C", "c", "D", "d",
    "E","E","E","E",
    "e","e","e","e",
    "I","I","I","I",
    "i","i","i","i",
    "N", "n",
    "O","O","O","O",
    "o","o","o","o",
    "U","U","U",
    "u","u","u",
    "Y",
    "y","y",
    "Th", "th"
  ];
  /**
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
   * @param {Event|falsy} evt
   *  - default: falsy (~ use arg elm)
   * @param {element} [elm]
   *  - default: falsy (~ use arg value)
   * @param {string} [value]
   * @return {void}
   */
  _machineNameValidate = function(evt, elm, value) {
    var v = evt ? this.value : (elm ? elm.value : value), le = v.length;
    if(le < 2 || le > 32 || !/[a-z_]/.test(v.charAt(0)) || !/[a-z\d_]/.test(v)) {
      alert( self.local("machineName") );
      return false;
    }
    return true;
  };
	/**
	 * @return {void}
	 */
	_resize = function() {
		var w = window, d = document.documentElement, dW, dD,
      wW = (dD = _innerWidth(d)) > (dW = _innerWidth(w)) ? dD : dW,
      hW = (dD = _innerHeight(d)) > (dW = _innerHeight(w)) ? dD : dW;
    //
    $("div#log_filter_filters")[ wW < 1400 ? "addClass" : "removeClass" ]("narrow");
	};
  /**
   * Resizes custom overlay to fill whole window/document; handler for window resize event.
	 * @return {void}
	 */
	_overlayResize = function() {
		var w = window, d = document.documentElement, dW, dD;
		_jqOverlay.css({
			width: ((dD = _innerWidth(d)) > (dW = _innerWidth(w)) ? dD : dW) + "px",
			height: ((dD = _innerHeight(d)) > (dW = _innerHeight(w)) ? dD : dW) + "px"
		});
	};
  /**
   * @param {boolean} [show]
   *  - default: falsy (~ hide)
   * @param {boolean|falsy} [opaque]
   *  - default: non-boolean (~ dont change opacity)
   * @param {string|falsy} [hoverTitle]
   *  - string: update the overlay's (hover) title attribute
   */
  _overlayDisplay = function(show, opaque, hoverTitle) {
    var jq = _jqOverlay, c = opaque;
    if(!show) {
      jq.hide();
    }
    if(c === true || c === false) {
      jq[ c ? "addClass" : "removeClass" ]("log-filter-overlay-opaque");
    }
    if(typeof hoverTitle === "string") {
      jq.get(0).setAttribute("title", hoverTitle);
    }
    if(show) {
      jq.show();
    }
  },
  /**
   * @return {void}
   */
  _submit = function() {
    //  Delay; otherwise it may in some situations not submit, presumably because _enable() hasnt finished it's job yet(?).
    setTimeout(function() {
      $(_elements.buttons.submit).trigger("click");
    }, 100);
  };
  /**
   * @return {void}
   */
  _prepareForm = function() {
    var oSels, oElms, nm, jq, elm, aElms, le, i, v, nOrderBy;
    try {
      //  Filter; do first because we need references to name and origin.
      oSels = _selectors.filter;
      oElms = _elements.filter;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          oElms[nm] = elm;
          switch(nm) {
            case "filter":
              //  Selecting a filter (whether stored or default/ad hoc) means submit form.
              jq.change(function() { // Submit if user checks filter_only_own.
                var v;
                switch(_.mode) {
                  case "create":
                  case "edit":
                    //  Not allowed, user must use the cancel button.
                    alert(self.local("filterChangeIllegal"));
                    _selectValue(this, _.name); // Reset to previous value.
                    return;
                }
                _elements.filter.name.value = v = _selectValue(this);
                _elements.settings.mode.value = v ? "stored" : "default";
                _enable(_elements.buttons.submit);
                _submit();
              });
              break;
            case "name_suggest": // May not exist.
              jq.keyup(_machineNameConvert);
              break;
            case "description": // May not exist.
              _.crudFilters = true;
              _textareaRemoveWrapper(elm); // Remove parent form-textarea-wrapper.
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
              //  Submit if user checks filter_only_own.
              jq.change(function() {
                if(this.checked) {
                  if(_.mode === "stored") {
                    _elements.settings.mode.value = "adhoc";
                    _selectValue(_elements.filter.filter, "");
                    _elements.filter.origin.value = _.name; // Pass name to origin.
                    _elements.filter.name.value = "";
                  }
                  _enable(_elements.buttons.submit);
                  _submit();
                }
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
                        o.time_to.value =
                        o.time_to_proxy.value = "";
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
              //  Put jQuery UI datepicker on time fields.
              jq.datepicker({
                dateFormat: _.dateFormat_datepicker
              });
              if((v = _elements.conditions[ nm === "time_from_proxy" ? "time_from" : "time_to" ].value) && (v = parseInt(v, 10))) {
                jq.datepicker("setDate", new Date(v * 1000));
              }
              jq.change(function() {
                var v, d, r = $("input[name=\'" + this.name.replace(/_proxy$/, "") + "\']").get(0);
                if((v = $.trim(this.value)).length) {
                  if((d = _dateFromFormat(v, _.dateFormat))) {
                    r.value = Math.floor(d.getTime() / 1000);
                    _.recordedValues.time_range = _elements.conditions.time_range.value = ""; // Clear time_range.
                  }
                  else {
                    alert( self.local("invalid_date", {"!date": v, "!format": _.dateFormat}) );
                    r.value = "";
                    return; // No change, skip _changedCriterion()
                  }
                }
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
            case "type_some":
              oElms[nm] = elm;
              //  Un-check type_any upon change in list of types (and fix formatting of the list).
              jq.change(function() {
                var v = this.value;
                _elements.conditions.type_any.checked = false;
                if(v && (v = $.trim(v))) {
                  //  Remove carriage return, comma and quotes. And trim every line.
                  this.value = v.replace(/[\r\,\"\']/g, "").replace(/[\ \n]+\n/g, "\n").replace(/\n[\ \n]+/g, "\n");
                }
                _changedCriterion();
              });
              //  Memorize initial list of types.
              _initialTypes = elm.value;
              break;
            case "role":
              oElms[nm] = elm;
              //  Clear uid when selecting a role.
              jq.change(function() {
                if(_selectValue(this)) {
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
                      alert(self.local("invalid_uid"));
                    }
                    this.value = v = "";
                  }
                  else {
                    _selectValue(_elements.conditions.role, ""); // Clear role when setting a uid.
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
                  this.value = v = $.trim(v);
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
                var v = this.value, nm = this.name === "log_filter_location" ? "location" : "referer"; // Not the same nm as iteration nm ;-)
                if(v !== "") {
                  this.value = v = $.trim(v);
                }
                if(v !== "" && !/^https?\:\/\/.+$/.test(v)) {
                  alert(self.local(nm === "location" ? "invalid_location" : "invalid_referer"));
                  this.value = v = "";
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
          _.recordedValues.orderBy.push(_selectValue(elm));
          //  There can't be two orderBys having same value.
          $(elm).change(function() {
            var v, index, i, a;
            if((v = _selectValue(this)) && v !== "_none") {
              index = parseInt(this.name.replace(/^log_filter_orderby_/, ""), 10) - 1;
              a = _elements.orderBy;
              for(i = 0; i < nOrderBy; i++) {
                if(i !== index && _selectValue(a[i][0]) === v) {
                  _selectValue(this, v = "");
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
          if(nm === "submit") {
            oElms[nm] = elm;
            jq.click(function() {
              _submitted = true;
              _overlayDisplay(1);
            });
          }
          else {
            oElms[nm] = elm;
            elm.setAttribute("type", "button"); // Fix type (apparant Form API shortcoming).
            jq.unbind(); // Remove Drupal native button handlers.
            switch(nm) {
              case "create":
              case "set_name":
              case "edit":
              case "del":
              case "cancel":
              case "save":
                if(_.crudFilters) {
                  oElms.crudFilters.push(elm);
                  jq.click(_crudRelay); // Set our common button handler.
                }
                break;
              case "delete_by_filter":
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
      _errorHandler(er, _name + "._prepareForm()");
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
      //  Hide all filter buttons.
      if(!submit && !initially && mode !== "delete") {
        $(_elements.buttons.crudFilters).hide();
      }
      if(!initially && _.delLogs) {
        _disable(_elements.buttons.delete_by_filter, self.local("deleteLogs_prohibit"));
      }
      switch(mode) {
        case "default":
          $("option[value='']", _elements.filter.filter).html( self.local("default") ); // Set visual value of filter selector's empty option.
          $(_elements.misc.title).html(self.local("default"));
          if(!initially) {
            _selectValue(_elements.filter.filter, "");
            _elements.filter.name.value = _.name = _elements.filter.origin.value = _.origin = "";
            if(_.crudFilters) {
              $([
                _elements.filter.name_suggest.parentNode.parentNode,
                _elements.filter.description.parentNode
              ]).hide();
              if ((elm = _elements.filter.require_admin)) {
                $(elm.parentNode).hide();
              }
            }
            _enable(_elements.buttons.submit);
          }
          if(_.crudFilters) {
            (elm = _elements.buttons.create).value = self.local("saveAs");
            $(elm).show();
            $(_elements.settings.onlyOwn.parentNode).show(); // Show only_own checkbox.
          }
          if(_.delLogs) {
            $([
              _elements.buttons.delete_by_filter,
              _elements.settings.delete_logs_max.parentNode,
            ]).show();
          }
          if(fromMode === "create") {
            fromMode = ""; // Dont keep 'create' as _.modePrevious.
          }
          break;
        case "adhoc":
          if(!initially) {
            _selectValue(_elements.filter.filter, "");
            if(_.crudFilters && (elm = _elements.filter.require_admin)) {
              $(elm.parentNode).hide();
            }
            _enable(_elements.buttons.submit);
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
            (elm = _elements.buttons.create).value = self.local("saveAs");
            $(elm).show();
            $([
              _elements.filter.name_suggest.parentNode.parentNode,
              _elements.filter.description.parentNode
            ]).hide();
            $(_elements.settings.onlyOwn.parentNode).show();
          }
          _enable(_elements.buttons.submit);
          if(_.delLogs) {
            $([
              _elements.buttons.delete_by_filter,
              _elements.settings.delete_logs_max.parentNode,
            ]).show();
          }
          break;
        case "stored": // stored mode may only appear on page load and after cancelling create.
          if(!initially) {
            if(fromMode === "create") {
              _elements.filter.name.value = _.name = _.origin;
              _elements.filter.origin.value = _.origin = "";
            }
            _selectValue(elm = _elements.filter.filter, nm = _.name);
            $("option[value='']", elm).html( self.local("default") ); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html( nm );
            if(_.crudFilters) {
              $([
                _elements.filter.name_suggest.parentNode.parentNode,
                _elements.filter.description.parentNode
              ]).hide();
              if ((elm = _elements.filter.require_admin)) {
                $(elm.parentNode).hide();
              }
            }
            _enable(_elements.buttons.submit);
          }
          if(_.crudFilters) {
            (elm = _elements.buttons.create).value = self.local("saveAsNew");
            $([
              _elements.buttons.edit,
              elm,
              _elements.buttons.del
            ]).show();
            $(_elements.settings.onlyOwn.parentNode).show(); // Show only_own checkbox.
          }
          if(_.delLogs) {
            $([
              _elements.buttons.delete_by_filter,
              _elements.settings.delete_logs_max.parentNode,
            ]).show();
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
              _selectValue(_elements.filter.filter, "");
              //  Pass current name to origin field.
              _elements.filter.origin.value = _.origin = nm = _.name;
              _elements.filter.name.value = _.name = "";
              $("option[value='']", _elements.filter.filter).html("(" + nm + ")"); // Set visual value of filter selector's empty option.
              $(_elements.misc.title).html( self.local("newForOrigin", {"!origin": nm} ) );
              break;
            default:
              throw new Error("Cant create from mode[" + fromMode + "].");
          }
          if ((elm = _elements.filter.require_admin)) {
            $(elm.parentNode).hide();
          }
          $([
            _elements.filter.name_suggest.parentNode.parentNode, // Show name_suggest.
            _elements.buttons.set_name,
            _elements.buttons.cancel
          ]).show();
          _disable(_elements.buttons.submit);
          $(_elements.settings.onlyOwn.parentNode).hide(); // Hide only_own checkbox.
          if(_.delLogs) {
            $([
              _elements.buttons.delete_by_filter,
              _elements.settings.delete_logs_max.parentNode,
            ]).hide();
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
            _selectValue(elm, nm);
          }
          $([
            _elements.filter.description.parentNode, // Show description.
            _elements.buttons.cancel,
            _elements.buttons.save
          ]).show();
          if ((elm = _elements.filter.require_admin)) {
            $(elm.parentNode).show();
          }
          $(_elements.filter.name_suggest.parentNode.parentNode).hide(); // Hide name_suggest.
          _disable(_elements.buttons.submit);
          $(_elements.settings.onlyOwn.parentNode).hide(); // Hide only_own checkbox.
          if(_.delLogs) {
            $([
              _elements.buttons.delete_by_filter,
              _elements.settings.delete_logs_max.parentNode,
            ]).hide();
          }
          break;
        case "delete": // Pop confirm(), and submit upon positive confirmation.
          if(!_.crudFilters) {
            throw new Error("Mode[" + mode + "] not allowed.");
          }
          _overlayDisplay(1, true); // Opaque.
          if (_elements.filter.name.value) {
            if(!confirm( self.local(
              "confirmDelete",
              {"!filter": _elements.filter.name.value}
            ))) {
              _overlayDisplay(0, false); // Transparent.
              return;
            }
            doSubmit = true;
            _overlayDisplay(1, false); // Transparent.
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
      _errorHandler(er, _name + "._setMode()");
    }
  };
  /**
   * Common handler for all CRUD buttons.
   *
   * @return {void}
   */
  _crudRelay = function() {
    var nm = this.name, o;
    try {
      switch(nm) {
        case "log_filter_reset":
          _resetCriteria();
          break;
        case "log_filter_create":
          _setMode("create");
          break;
        case "log_filter_set_name":
          var elm = _elements.filter.name_suggest, v = elm.value;
          if(_ajaxRequestingBlocking) { // Prevent double-click.
            return false; // false for IE<9's sake.
          }
          //  No reason to trim(), because change handler (_machineNameChange()) replaces spaces with underscores.
          if(!v.length || !_machineNameValidate(null, null, v)) {
            return false; // false for IE<9's sake.
          }
          if($.inArray(v, _filters) > -1) {
            alert(self.local("filterNameDupe", {"!name": v}));
            return false; // false for IE<9's sake.
          }
          _overlayDisplay(1, null, self.local("waitCreate"));
          _ajaxRequestingBlocking = true;
          _ajaxRequest("create", {
            name: v,
            require_admin: _elements.filter.require_admin ? 1 : 0 // Create with require_admin if the element exists (the user has the permission).
          });
          break;
        case "log_filter_edit":
          _setMode("edit");
          break;
        case "log_filter_delete":
          _setMode("delete");
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
          break;
        case "log_filter_delete_by_filter":
          if(_.delLogs) {
            _overlayDisplay(1, false);
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
      _errorHandler(er, _name + "._crudRelay()");
    }
    return false; // false for IE<9's sake.
  };
  /**
   * Change handler for all condition and orderBy fields.
   *
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
            _disable(_elements.buttons.delete_by_filter, self.local("deleteLogs_prohibit")); // Because we don't _setMode(), which does that.
          }
          break;
        case "stored":
          _setMode("adhoc");
          break;
        case "create":
          break;
        case "edit":
          break;
        case "delete":
          break;
        default:
          throw new Error("Mode[" + _.mode + "] not supported.");
      }
    }
    catch(er) {
      _errorHandler(er, _name + "._changedCriterion()");
    }
  };
  /**
   * Clear all condition and orderby fields, and set defaults.
   *
   * @return {void}
   */
  _resetCriteria = function() {
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
            r.value = _initialTypes;
            break;
          default:
            r.value = "";
        }
      }
    }
    le = (a = _elements.orderBy).length;
    //  Default to order by time ascending, only.
    for(i = 0; i < le; i++) {
      _selectValue(a[i][0], i ? "" : "time");
      a[i][1].checked = i ? false : "checked";
    }
    //  Degrade mode.
    if(_.mode === "adhoc") {
      _setMode("default");
    }
    //else if(_.mode === "stored") {
    else {
      _setMode("adhoc");
    }
  };
  /**
   * For querying backend.
   *
   * Must be called delayed (after displaying overlay) to secure that validation (set-up in _prepareForm()) has done it's job.
   *
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
              if((v = _selectValue(r)) !== "" && v !== "_none" && (v = $.trim(v)) && (v = parseInt(v, 10))) {
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
                  conditions[nm] = v;
                }
              }
              break;
            case "type_some":
              if(!oElms.type_any.checked &&
                  (v = r.value) !== "" && (v = $.trim(v)) !== "" &&
                  // Remove carriage return, comma and quotes. And trim every line.
                  (v = v.replace(/[\r\,\"\']/g, "").replace(/[\ \n]+\n/g, "\n").replace(/\n[\ \n]+/g, "\n")) !== "" &&
                  v !== "\n"
              ) {
                ++n;
                conditions[nm] = v;
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
        if((v = _selectValue(oElms[i][0])) && v !== "_none" && (v = $.trim(v))) {
          order_by.push([
            v,
            oElms[i][1].checked ? "DESC" : "ASC"
          ]);
        }
      }
    }
    catch(er) {
      _errorHandler(er, _name + "._getCriteria()");
    }
    return {
      nConditions: n,
      conditions: conditions,
      order_by: order_by
    };
  };
  /**
   * @return {void}
   */
  _deleteLogs = function() {
    var o = _getCriteria(), v, max = (v = _elements.settings.delete_logs_max.value) !== "" ? v : 0;

    //  @todo: have to use jQuery UI dialog instead of confirm(), because in Firefox those dialogs arent draggable,
    //  thus the user cannot inspect the filter while the confirm() is up.

    //  Actual deletion is performed via an ordinary page request; the backend submit method deletes the logs (if the field delete_logs is on).

    if(!o.nConditions) { // Even stored filters go here; if a stored filter has no conditions, than THAT is the important thing.
      if(!max) {
        if(!confirm( self.local("deleteLogs_all") )) {
          _overlayDisplay(0, false);
          return;
        }
      }
      else if(!confirm( self.local("deleteLogs_noConditions", { "!number": v }) )) {
        _overlayDisplay(0, false);
        return;
      }
    }
    else if(_.mode === "stored") {
      if(!max) {
        if(!confirm( self.local("deleteLogs_storedNoMax", { "!name": _.name }) )) {
          _overlayDisplay(0, false);
          return;
        }
      }
      else if(!confirm( self.local("deleteLogs_stored", { "!name": _.name, "!number": v }) )) {
        _overlayDisplay(0, false);
        return;
      }
    }
    else if(!max) {
      if(!confirm( self.local("deleteLogs_adhocNoMax") )) {
        _overlayDisplay(0, false);
        return;
      }
    }
    else if(!confirm( self.local("deleteLogs_adhoc", { "!number": v }) )) {
      _overlayDisplay(0, false);
      return;
    }
    //_elements.filter.delete_logs.value = "1";
    //_submit();
  }
  /**
   * @type {object}
   */
  _ajaxResponse = {
    create: function(oResp) { // Only saves a default filter with a name; progress to edit mode on success.
      var nm = oResp.name;
      if(oResp.success) {
        _elements.filter.origin.value = _.origin = _.name;
        _elements.filter.name.value = _.name = nm;
        _filters.push(nm);
        _overlayDisplay(0, null, self.local("wait")); // Reset.
        _setMode("edit");
      }
      else {
        switch(oResp.error_code) {
          case 10: // Missing permission.
            alert( self.local("error_noPermission") );
            _submit();
            break;
          case 20: // Filter name already exists.
            alert( self.local("machineName") );
            _overlayDisplay(0, null, self.local("wait")); // Reset.
            break;
          case 30: // Invalid machine name.
            alert( self.local("filterNameDupe", {"!name": nm}) );
            _overlayDisplay(0, null, self.local("wait")); // Reset.
            break;
          case 90: // Database error.
            alert(self.local("error_dbSave"));
            _submit();
            break;
          default: // Unknown error code.
            _errorHandler(null, "LogFilter._ajaxResponse.create(), :\n" + inspect.get(o));
            alert( self.local("error_unknown") );
            _submit();
        }
      }
      _ajaxRequestingBlocking = false;
    }
  };
  /**
   * @param {string} action
   * @param {object} oData
   * @return {void}
   */
  _ajaxRequest = function(action, oData) {
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
        if(textStatus === "success" && $.type(oResp) === "object") {
          _ajaxResponse[ action ](oResp);
        }
        else {
          o = {
            source: "ajax request",
            action: action,
            textStatus: textStatus,
            oResp: oResp
          };
          _.errors.push(o);
          _errorHandler(null, "LogFilter._ajaxRequest():\n" + inspect.get(o));
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        var o = {
          source: "ajax request",
          action: action,
          textStatus: textStatus,
          errorThrown: errorThrown
        };
        _.errors.push(o);
        _errorHandler(null, "LogFilter._ajaxRequest():\n" + inspect.get(o));
      }
    });
  };
  /**
   * @param {string|falsy} [prop]
   * @return {void}
   */
  this.inspect = function(prop) {
    inspect(!prop ? _ : _[prop], "LogFilter" + (!prop ? "" : (" - " + prop)));
  };
  /**
   * @param {string|falsy} [group]
   * @return {void}
   */
  this.inspectElements = function(group) {
    inspect(!group ? _elements : _elements[group], "_elements" + (!group ? "" : ("." + group)));
  };
  /**
   * Caches translated labels/message having no replacers.
   *
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
        case "saveAs":
          _local[nm] = s = Drupal.t("Save as...");
          break;
        case "saveAsNew":
          _local[nm] = s = Drupal.t("Save as new");
          break;
        case "confirmDelete":
          //  { "!filter": _elements.filter.name.value }
          s = Drupal.t("Are you sure you want to delete the filter!newline!filter?", replacers);
          break;
        case "invalid_date":
          //  {"!date": v, "!format": _.dateFormat}
          s = Drupal.t("The date '!date' is not valid!newline- please use the format: !format", replacers);
          break;
        case "invalid_uid":
          _local[nm] = s = Drupal.t("User ID must be a positive number, or empty");
          break;
        case "invalid_location":
          _local[nm] = s = Drupal.t("Location must be a URL, or empty");
          break;
        case "invalid_referer":
          _local[nm] = s = Drupal.t("Referrer must be a URL, or empty");
          break;
        case "filterChangeIllegal":
          _local[nm] = s = Drupal.t("Press the 'Cancel' button,!newlineif you don't want to create/edit current filter.");
          break;
        case "machineName":
          _local[nm] = s = Drupal.t("The filter name:!newline- must be 2 to 32 characters long!newline- must only consist of the characters a-z, letters, and underscore (_)!newline- cannot start with a number");
          break;
        case "filterNameDupe":
          //  {"!name": name}
          s = Drupal.t("There's already a filter named!newline'!name'.", replacers);
          break;
        case "wait":
          _local[nm] = s = Drupal.t("Please wait a sec...");
          break;
        case "waitCreate":
          _local[nm] = s = Drupal.t("Creating new filter. Please wait a sec...");
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
        case "error_noPermission":
          _local[nm] = s = Drupal.t("Sorry, bad error,!newlinebut no loss of data.");
          break;
        case "error_dbSave":
          _local[nm] = s = Drupal.t("Sorry, failed to save data.");
          break;
        case "error_unknown":
          _local[nm] = s = Drupal.t("Sorry, something unexpected happened.");
          break;
        default:
          s = "[LOCAL: " + nm + "]";
      }
    }
    return s.replace(/\!newline/g, "\n");
  };
  /**
   * @function
   * @name LogFilter.init
   * @return {void}
   */
  this.init = function() {
    this.init = function() {};
    //	Create overlay, to prevent user from doing anything before page load and after form submission.
		$("body").append(
			"<div id=\"log_filter_overlay\" tabindex=\"10000\" title=\"" + self.local("wait") + "\">&nbsp;</div>"
		);
		_jqOverlay = $("div#log_filter_overlay");
    _overlayResize();
		$(window).resize(function() {
			_overlayResize();
		});
  };
  /**
   *
   *
   *  Options:
   *  - (int) x
   * @function
   * @name LogFilter.setup
   * @param {obj} [options]
   * @return {void}
   */
  this.setup = function(filters) {
    _filters = filters || [];

    this.setup = function() {};

    _prepareForm();

    _setMode(_.mode, false, true);

    _resize();
    $(window).resize(_resize);

    _overlayDisplay(0);
  };
};

window.LogFilter = new LogFilter($);

})(jQuery);