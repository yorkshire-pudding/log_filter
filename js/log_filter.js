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
    origin: ""
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
  _submitted,
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
      time_range: "input[name='log_filter_time_range']",
      time_from: "input[name='log_filter_time_from']",
      time_from_proxy: "input[name='log_filter_time_from_proxy']",
      time_to: "input[name='log_filter_time_to']",
      time_to_proxy: "input[name='log_filter_time_to_proxy']",
      severity_any: "input[name='log_filter_severity[-1]']",
      severity_some: "div#edit-log-filter-severity input:not([name='log_filter_severity[-1]'])", // More elements.
      type_any: "input[name='log_filter_type_wildcard']",
      type_some: "textarea[name='log_filter_type']", // Single element.
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
      crud: [] // create, edit, del, cancel, save.
    },
    misc: {}
  },
  _initialTypes = "",

  //  Declare private methods, to make IDEs list them
  _errorHandler, _o, _innerWidth, _innerHeight, _dateFromFormat, _selectValue, _submit, _resize, _overlayResize,
  _ajax, _crudRelay, _prepareForm, _resetCriteria, _changedCriterion, _setMode, _onFilterCreated,
  _textareaRemoveWrapper, _buttonDisable, _buttonEnable, _selectDisable, _selectEnable, _machineNameConvert, _machineNameValidate, _toLeading, _toAscii;
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
  _o = function(o, k0, k1) {
    var t = typeof o;
    return o && (t === "object" || t === "function") && o.hasOwnProperty(k0) ?
        (k1 === undefined ? o[k0] : (
            (o = o[k0]) && ((t = typeof o) === "object" || t === "function") && o.hasOwnProperty(k1) ? o[k1] : undefined
        ) ) : undefined;
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
   * @return {void}
   */
  _submit = function() {
    //  Delay; otherwise it may in some situations not submit, presumably because _buttonEnable() hasnt finished it's job yet(?).
    setTimeout(function() {
      $(_elements.buttons.submit).trigger("click");
    }, 100);
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
   * @return {void}
   */
  _buttonDisable = function(elm) {
    elm.disabled = "disabled";
    $(elm).addClass("form-button-disabled");
  };
  /**
   * @param {element} elm
   * @return {void}
   */
  _buttonEnable = function(elm) {
    elm.disabled = false;
    $(elm).removeClass("form-button-disabled");
  };
  /**
   * @param {element} elm
   * @return {void}
   */
  _selectDisable = function(elm) {
    elm.disabled = "disabled";
    $(elm).css("cursor", "not-allowed");
  };
  /**
   * @param {element} elm
   * @return {void}
   */
  _selectEnable = function(elm) {
    elm.disabled = false;
    $(elm).css("cursor", "pointer");
  };
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
   * @param {element} elm
   * @return {void}
   */
  _machineNameValidate = function(elm) {
    var v = elm.value, le = v.length;
    if(le < 2 || le > 32 || !/[a-z_]/.test(v.charAt(0)) || !/[a-z\d_]/.test(v)) {
      alert( self.local("machineName") ) ;
      return false;
    }
    return true;
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
  _prepareForm = function() {
    var oSels, oElms, nm, jq, elm, aElms, le, i, v;
    try {
      //  Filter; do first because we need references to name and origin.
      oSels = _selectors.filter;
      oElms = _elements.filter;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          oElms[nm] = elm;
          switch(nm) {
            case "filter":
              //  Selecting a stored filter - or default filter - means submit form.
              jq.change(function() { // Submit if user checks filter_only_own.
                var v;
                switch(_.mode) {
                  case "create":
                  case "edit":
                    //  Not allowed, user must use the cancel button.
                    return;
                }
                _elements.filter.name.value = v = _selectValue(this);
                _elements.settings.mode.value = v ? "stored" : "default";
                _buttonEnable(_elements.buttons.submit);
                _submit();
              });
              break;
            case "name_suggest":
              jq.keyup(_machineNameConvert);
              break;
            case "description":
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
            case "onlyOwn":
              //  Submit if user checks filter_only_own.
              jq.change(function() {
                if(this.checked) {
                  if(_.mode === "stored") {
                    _elements.settings.mode.value = "adhoc";
                    _selectValue(_elements.filter.filter, "");
                    _elements.filter.origin.value = _.name; // Pass name to origin.
                    _elements.filter.name.value = "";
                  }
                  _buttonEnable(_elements.buttons.submit);
                  _submit();
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
            case "time_from": // Hidden fields.
            case "time_to":
              oElms[nm] = elm;
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
              });
              jq.change(_changedCriterion); // Criterion change handler.
              break;
            default:
              oElms[nm] = elm;
              jq.change(_changedCriterion); // Criterion change handler.
              switch(nm) {
                case "time_from_proxy":
                case "time_to_proxy":
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
                      }
                      else {
                        r.value = "";
                        alert( self.local("invalidDate", {"!date": v, "!format": _.dateFormat}) );
                      }
                    }
                  });
                  break;
                case "severity_any":
                  //  Un-check specific severities upon checking severity:any.
                  jq.change(function() {
                    var a, le, i;
                    if(this.checked) {
                      le = (a = _elements.conditions.severity_some).length;
                      for(i = 0; i < le; i++) {
                        a[i].checked = false;
                      }
                    }
                  });
                  break;
                case "type_some":
                  //  Un-check type_any upon change in list of types (and fix formatting of the list).
                  jq.change(function() {
                    var v = this.value;
                    _elements.conditions.type_any.checked = false;
                    if(v && (v = $.trim(v))) {
                      this.value = v.replace(/[\r\,\"\']/g, "").replace(/[\ \n]+\n/g, "\n").replace(/\n[\ \n]+/g, "\n");
                    }
                  });
                  //  Memorize initial list of types.
                  _initialTypes = elm.value;
                  break;
              }
          }
        }
      }
      //  Order by.
      oElms = _elements.orderBy; // Array.
      if((le = (aElms = (jq = $(_selectors.orderBy.options)).get()).length)) {
        for(i = 0; i < le; i++) {
          oElms.push(
            [ elm = aElms[i] ]
          );
          $(elm).change(_changedCriterion); // Criterion change handler.
        }
        if((le = (aElms = (jq = $(_selectors.orderBy.bools)).get()).length)) {
          for(i = 0; i < le; i++) {
            oElms[i].push(
              elm = aElms[i]
            );
            $(elm).change(_changedCriterion); // Criterion change handler.
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
              _jqOverlay.show();
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
                oElms.crud.push(elm);
                jq.click(_crudRelay); // Set our common button handler.
                break;
              case "delete_by_filter": // Dont put in .crud array, because we have to show/hide this using visibility instead of display.
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
    var fromMode = _.mode, doSubmit, elm, nm, v;
    try {
      if(_submitted) {
        return;
      }
      //  Hide all filter buttons.
      if(!submit && !initially && mode !== "delete") {
        $(_elements.buttons.crud).hide();
      }
      switch(mode) {
        case "default":
          $("option[value='']", _elements.filter.filter).html( self.local("default") ); // Set visual value of filter selector's empty option.
          $(_elements.misc.title).html(self.local("default"));
          if(!initially) {
            _selectEnable(elm = _elements.filter.filter);
            _selectValue(elm, "");
            _elements.filter.name.value = _.name = _elements.filter.origin.value = _.origin = "";
            $([
              _elements.filter.name_suggest.parentNode.parentNode,
              _elements.filter.description.parentNode
            ]).hide();
            if ((elm = _elements.filter.require_admin)) {
              $(elm.parentNode).hide();
            }
            _buttonEnable(_elements.buttons.submit);
          }
          (elm = _elements.buttons.create).value = self.local("saveAs");
          $(elm).show();
          $(_elements.settings.onlyOwn.parentNode).show(); // Show only_own checkbox.
          $(_elements.buttons.delete_by_filter.parentNode.parentNode).css("visibility", "hidden");
          break;
        case "adhoc":
          if(!initially) {
            _selectEnable(elm = _elements.filter.filter);
            _selectValue(elm, "");
            if ((elm = _elements.filter.require_admin)) {
              $(elm.parentNode).hide();
            }
            _buttonEnable(_elements.buttons.submit);
          }
          if(fromMode === "stored") {
            //  Pass current name to origin field.
            _elements.filter.origin.value = _.origin = nm = _.name;
            _elements.filter.name.value = _.name = "";
            $("option[value='']", _elements.filter.filter).html("(" + nm + ")"); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html( self.local("adhocForOrigin", {"!origin": nm} ) );
          }
          else {
            $("option[value='']", _elements.filter.filter).html(self.local("adhoc")); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html(self.local("adhoc"));
          }
          (elm = _elements.buttons.create).value = self.local("saveAs");
          $(elm).show();
          $([
            _elements.filter.name_suggest.parentNode.parentNode,
            _elements.filter.description.parentNode
          ]).hide();
          _buttonEnable(_elements.buttons.submit);
          $(_elements.settings.onlyOwn.parentNode).show();
          $(_elements.buttons.delete_by_filter.parentNode.parentNode).css("visibility", "visible");
          break;
        case "stored": // stored mode may only appear on page load and after cancelling create.
          if(!initially) {
            _selectEnable(elm = _elements.filter.filter);
            _selectValue(elm, nm = _.name);
            $("option[value='']", _elements.filter.filter).html( self.local("default") ); // Set visual value of filter selector's empty option.
            $(_elements.misc.title).html( nm );
            $([
              _elements.filter.name_suggest.parentNode.parentNode,
              _elements.filter.description.parentNode
            ]).hide();
            if ((elm = _elements.filter.require_admin)) {
              $(elm.parentNode).hide();
            }
            _buttonEnable(_elements.buttons.submit);
          }
          (elm = _elements.buttons.create).value = self.local("saveAsNew");
          $([
            _elements.buttons.edit,
            elm,
            _elements.buttons.del
          ]).show();
          $(_elements.settings.onlyOwn.parentNode).show(); // Show only_own checkbox.
          $(_elements.buttons.delete_by_filter.parentNode.parentNode).css("visibility", "visible");
          break;
        case "create":
          _selectDisable(_elements.filter.filter);
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
          _buttonDisable(_elements.buttons.submit);
          $(_elements.settings.onlyOwn.parentNode).hide(); // Hide only_own checkbox.
          $(_elements.buttons.delete_by_filter.parentNode.parentNode).css("visibility", "hidden");
          break;
        case "edit":
          if(fromMode === "create") {
            //  If going from create to edit: memorize mode right before create, to prevent ending up having (useless) create as previous mode.

            //  NB: This is not sufficient: sometimes mode gets wrong and name get empty when is shouldnt.
            //  Test it by doing create, cancel, create, cancel...

            fromMode = _.modePrevious;
            $("option[value='']", _elements.filter.filter).html(_.name);
          }
          _selectDisable(_elements.filter.filter);
          $([
            _elements.filter.description.parentNode, // Show description.
            _elements.buttons.cancel,
            _elements.buttons.save
          ]).show();
          if ((elm = _elements.filter.require_admin)) {
            $(elm.parentNode).show();
          }
          $(_elements.filter.name_suggest.parentNode.parentNode).hide(); // Hide name_suggest.
          _buttonDisable(_elements.buttons.submit);
          $(_elements.settings.onlyOwn.parentNode).hide(); // Hide only_own checkbox.
          $(_elements.buttons.delete_by_filter.parentNode.parentNode).css("visibility", "hidden");
          break;
        case "delete": // Pop confirm(), and submit upon positive confirmation.
          _jqOverlay.addClass("log-filter-overlay-opaque").show();
          if (_elements.filter.name.value) {
            if(!confirm( self.local(
              "confirmDelete",
              {"!filter": _elements.filter.name.value}
            ))) {
              _jqOverlay.removeClass("log-filter-overlay-opaque").hide();
              return;
            }
            doSubmit = true;
            _jqOverlay.removeClass("log-filter-overlay-opaque");
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
          break;
        case "stored":
          _setMode("adhoc");
          break;
        case "create":
          break;
        case "edit":
          //_elements.buttons.save.disabled = false;
          //_buttonEnable(_elements.buttons.save);
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
   * @param {object} oResp
   * @return {void}
   */
  _onFilterCreated = function(oResp) {
    _elements.filter.origin = _.origin = _.name;
    _elements.filter.name = _.name = oResp.name;
    _jqOverlay.hide().get(0).setAttribute("title", self.local("wait"));
    _setMode("edit");
  };
  /**
   * Common handler for all CRUD buttons.
   *
   * @return {void}
   */
  _crudRelay = function() {
    var nm = this.name;
    try {
      switch(nm) {
        case "log_filter_reset":
          _resetCriteria();
          break;
        case "log_filter_create":
          _setMode("create");
          break;
        case "log_filter_set_name":
          if(!_machineNameValidate(_elements.filter.name_suggest)) {
            return false; // false for IE<9's sake.
          }
          _jqOverlay.show().get(0).setAttribute("title", self.local("waitCreate"));

          //  ...if successfully saved filter by that name in database, call _onFilterCreated() at response...
          setTimeout(function() {
            _onFilterCreated({name: _elements.filter.name_suggest.value}); // the argument must of course be the response object; this is just dummy.
          }, 500);

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
                  //  Revert.
                  _elements.filter.name = _.name = _.origin;
                  _elements.filter.origin = _.origin = "";
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
          _elements.filter.delete_logs.value = "1";
          _submit();
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
   * @param {str} act
   * @return {void}
   */
  _ajax = function(act) {
    $.ajax({
      url: "/log_filter/ajax/" + _.x,
      type: "POST",
      data: {
        action: act
      },
      dataType: "json", // expects json formatted response data
      cache: false,
      /**
        * @return {void}
        * @param {obj} responseData
        *  - (str) action
        *  - (bool) success
        *  - (string) error
        *  - (string) message
        *  - (int|undefined) sessionTimeout
        * @param {str} textStatus
        * @param {obj} jqXHR
        */
      success: function(oResp, textStatus, jqXHR) {
        var u, d, t, st, sw, ci, to, to1;
        if(textStatus === "success" && $.type(oResp) === "object") {
          if(oResp.success) {
            if(oResp.action === "x") {
              return;
            }
            switch(oResp.action) {
              case "y":

                break;
              default: // unknown action
                try {
                  throw new Error("Unknown action["+oResp.action+"]")
                }
                catch(er) {
                  inspect.trace(er, "LogFilter._ajax()");
                }
                return;
            }
          }
          else {
            inspect(oResp, "LogFilter._ajax()");
          }
        }
        else {
          _.errors.push("response: " + textStatus);
          inspect({
              textStatus: textStatus,
              response_data: oResp
          }, "LogFilter._ajax()");
        }
      },
      error: function(jqXHR, textStatus, errorThrown) {
        _.errors.push("response: " + textStatus);
        inspect({
            textStatus: textStatus,
            errorThrown: errorThrown
        }, "LogFilter._ajax()");
      }
    });
  };
  /**
   * @return {void}
   */
  this.inspect = function() {
    inspect(_, "LogFilter");
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
    if(!(s = _o(_local, nm))) { // English t message overridden?
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
          s = Drupal.t("Are you sure you want to delete the filter\n!filter?", replacers);
          break;
        case "dateInvalid":
          //  {"!date": v, "!format": _.dateFormat}
          s = Drupal.t("The date '!date' is not valid\n- please use the format: !format", replacers);
          break;
        case "machineName":
          _local[nm] = s = Drupal.t("The filter name:\n- must be 2 to 32 characters long\n- must only consist of the characters a-z, letters, and underscore (_)\n- cannot start with a number");
          break;
        case "wait":
          _local[nm] = s = Drupal.t("Please wait a sec...");
          break;
        case "waitCreate":
          _local[nm] = s = Drupal.t("Creating new filter. Please wait a sec...");
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
  this.setup = function(options) {
    this.setup = function() {};

    _prepareForm();

    _setMode(_.mode, false, true);

    _resize();
    $(window).resize(_resize);

    _jqOverlay.hide();
  };
};

window.LogFilter = new LogFilter($);

})(jQuery);