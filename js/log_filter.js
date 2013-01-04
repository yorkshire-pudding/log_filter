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
   * @type {boolean|undefined}
   */
  _init,
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
    mode: 'default' // default | adhoc | stored | create | edit | delete
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
   * @type {bool|undefined}
   */
  _jqUiDial,
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
      description: "textarea[name='log_filter_description']"
    },
    conditions: {
      time_range: "input[name='log_filter_time_range']",
      time_from: "input[name='log_filter_time_from']",
      time_from_display: "input[name='log_filter_time_from_display']",
      time_to: "input[name='log_filter_time_to']",
      time_to_display: "input[name='log_filter_time_to_display']",
      /*severity: {
        all: "input[name='log_filter_severity[-1]']",
        some: "div#edit-log-filter-severity input:not([name='log_filter_severity[-1]'])"
      },*/
      severity_any: "input[name='log_filter_severity[-1]']",
      severity_some: "div#edit-log-filter-severity input:not([name='log_filter_severity[-1]'])", // More elements.
      /*type: {
        all: "input[name='log_filter_type_wildcard']",
        some: "textarea[name='log_filter_type']"
      },*/
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
      reset: "input[name='log_filter_reset']", // Not part of filter dialog.
      create: "input[name='log_filter_create']",
      copy: "input[name='log_filter_copy']",
      edit: "input[name='log_filter_edit']",
      del: "input[name='log_filter_delete']",
      save: "input[name='log_filter_save']",
      delByFilter: "input[name='log_filter_delete_by_filter']",
      submit: "input#edit-submit"
    }
  },
  _elements = {
    settings: {},
    filter: {},
    conditions: {},
    orderBy: [], // Array.
    buttons: {
      all: []
    }
  },
  _initialTypes = "",

  //  Declare private methods, to make IDEs list them
  _local, _o, _innerWidth, _innerHeight, _dateFromFormat, _selectValue, _resize,
  _ajax, _controlRelay, _filterSelector, _prepareForm, _resetCriteria, _changedCriterion, _setMode;
  /**
   * @ignore
   * @private
   * @param {str} nm
   * @return {str}
   */
  _local = function(nm) {
    var s;
    //  S.... Drupal.t() doesnt use the 'g' flag when replace()'ing, so Drupal.t() replacement is utterly useless - and nowhere to report the bug :-(
    if(!(s = _o(_localEn, nm))) { // English t message overridden?
      switch(nm) {
        case "x":
          s = Drupal.t("X.!newlineY !link_startZ!link_end.");
          break;
        default:
          s = "[LOCAL: " + nm + "]";
      }
    }
    return s.replace(/\!newline/g, "\n");
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
    //  get ----------------
    //  translating selectedIndex to actual option is weird/error prone, so we use jQuery list of options instead
    if(val === undefined) {
      nOpts = (rOpts = $("option", elm).get()).length;
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
    elm.selectedIndex = -1;
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
    nOpts = (rOpts = $("option", elm).get()).length;
    for(i = 0; i < nOpts; i++) {
      if( ( (r = rOpts[i]).selected =
          $.inArray(r.value, v) > -1 ? "selected" : false)
      ) { // set? and count
        ++set;
        if(!multi) {
          return 1;
        }
      }
    }
    return set;
  };


  _filterSelector = function(evt, elm) {
    var r = elm || this, val = _selectValue(r), context = $("div#log_filter_filters").get(0);

    $("input[type='button']", context).hide();

    switch(val) {
      case "":
      case "_none":
        $("input[name='log_filter_create']", context).show();
        break;
      case 22:
        //
        break;
      case 11:
        //
        break;
      default:
    }
  };


  _prepareForm = function() {
    var o, jq, a, le, i, elm, type, v;

    //  Buttons; get element references, and fix some issues.
    (function() {
      var oSels = _selectors.buttons, oElms = _elements.buttons, nm, jq, elm;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          if(nm === "submit") {
            oElms[nm] = elm;
          }
          else {
            oElms[nm] = elm;
            elm.setAttribute("type", "button"); // Fix type (apparant Form API shortcoming).
            jq.unbind(); // Remove Drupal native button handlers.
            //  If filter button: add to list of those, and set our common button handler.
            if(nm !== "reset") {
              oElms.all.push(elm);
              jq.click(_controlRelay);
            }
          }
        }
      }
    })();
    //inspect(_elements.buttons);

    //  Fields; get element references, and fix some issues.
    (function() {
      var oSels, oElms, nm, jq, elm, aElms, le, i, v;
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
                    _elements.filter.origin.value = _elements.filter.name.value; // Pass name to origin.
                    _elements.filter.name.value = "";
                  }
                  $(_elements.buttons.submit).trigger("click");
                }
              });
              break;
          }
        }
      }
      //  Filter.
      oSels = _selectors.filter;
      oElms = _elements.filter;
      for(nm in oSels) {
        if(oSels.hasOwnProperty(nm) && (elm = (jq = $(oSels[nm])).get(0))) {
          oElms[nm] = elm;
          switch(nm) {
            case "filter":
              //  Selecting a stored filter - or default filter - means submit form.
              jq.change(function() { // Submit if user checks filter_only_own.
                var v = _selectValue(this);
                _elements.filter.name.value = v;
                _elements.settings.mode.value = v ? "stored" : "default";
                $(_elements.buttons.submit).trigger("click");
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
                _elements.conditions.severity_any.checked = false;
              });
              break;
            default:
              oElms[nm] = elm;
              jq.change(_changedCriterion); // Criterion change handler.
              switch(nm) {
                case "time_from_display":
                case "time_to_display":
                  //  Put jQuery UI datepicker on time fields.
                  jq.datepicker({
                    dateFormat: _.dateFormat_datepicker
                  });
                  if((v = _elements.conditions[ nm === "time_from_display" ? "time_from" : "time_to" ].value) && (v = parseInt(v, 10))) {
                    jq.datepicker("setDate", new Date(v * 1000));
                  }
                  jq.change(function() {
                    var v, d, r = $("input[name=\'" + this.name.replace(/_display$/, "") + "\']").get(0);
                    if((v = $.trim(this.value)).length) {
                      if((d = _dateFromFormat(v, _.dateFormat))) {
                        r.value = Math.floor(d.getTime() / 1000);
                      }
                      else {
                        r.value = "";
                        alert( Drupal.t("The date '!date' is not valid\n- please use the format: !format", {"!date": v, "!format": _.dateFormat}) );
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
    })();
    //inspect(_elements.conditions);
    //inspect(_elements.orderBy);


    //  Show buttons according to mode.
    switch(_.mode) {
      case "default":
        $("div.form-item-log-filter-only-own").show();
        $(_selectors.buttons.create).show();
        break;
      case "adhoc":
        $("div.form-item-log-filter-only-own").show();
        $(_selectors.buttons.create).show();
        break;
      case "stored":
        $("div.form-item-log-filter-only-own").show();
        $(_selectors.buttons.copy).show();
        $(_selectors.buttons.edit).show();
        $(_selectors.buttons.del).show();
        break;
      case "create": // Frontend should only see this mode if backend validation rejects the form.
        $(_selectors.buttons.save).show();
        $(_selectors.filter.name).parent().show();
        $(_selectors.filter.description).parent().parent().show();
        break;
      case "edit":
        $(_selectors.buttons.del).show();
        $(_selectors.buttons.save).show();
        $(_selectors.filter.description).parent().parent().show();
        break;
      case "delete": // Frontend should never see this mode on page load.
      default:
        inspect.log(_.mode, {
          category: "log_filter",
          message: "Mode[" + _.mode + "] " + (_.mode === "delete" ? "not valid in frontend" : "not supported."),
          severity: "error"
        });
        //  Reset criteria, and reload page.
        _elements.settings.mode.value = "default";
        _resetCriteria();
        $(_elements.buttons.submit).trigger("click");
        break;
    }
  };


  _setMode = function(to) {
    var elm, nm;
    switch(to) {
      case "default":
        $("div.form-item-log-filter-only-own").show();
        break;
      case "adhoc":
        $("div.form-item-log-filter-only-own").show();
        if(_.mode === "stored") {
          nm = (elm = $(_selectors.filter.name).get(0)).value;
          $("#log_filter_title_display").html(
            Drupal.t("Ad hoc - based on !origin", {"!origin": nm} )
          );
          elm.value = "";
          $(_selectors.filter.origin).get(0).value = nm;
        }
        _.mode = to;
        $(_selectors.settings.mode).get(0).value = to;
        _selectValue($(_selectors.filter.filter).get(0), "");
        $(_selectors.buttons.all).hide();
        break;
      case "stored":
        $("div.form-item-log-filter-only-own").show();
        break;
      case "create":
        $("div.form-item-log-filter-only-own").hide();
        break;
      case "edit":
        $("div.form-item-log-filter-only-own").hide();
        break;
      case "delete":
        break;
      default:
        inspect.log(to, {
          category: "log_filter",
          message: "Mode[" + to + "] not supported.",
          severity: "error"
        });
    }
  };


  _changedCriterion = function() {
    var jq, elm, nm;
    switch(_.mode) {
      case "default":
        break;
      case "adhoc":
        break;
      case "stored":
        _setMode("adhoc");
        break;
      case "create":
        break;
      case "edit":
        $(_selectors.buttons.save).show(); // Too often...
        break;
      case "delete":
        break;
      default:
        inspect.log(_.mode, {
          category: "log_filter",
          message: "Mode[" + _.mode + "] not supported.",
          severity: "error"
        });
    }
  };

  _resetCriteria = function() {
    var o = _selectors.conditions, k, v, a, b, le, i;
    for(k in o) {
      if(o.hasOwnProperty(k)) {
        v = o[k];
        switch(k) {
          case "severity":
            $(v.all).get(0).checked = "checked";
            le = (a = $(v.some).get()).length;
            for(i = 0; i < le; i++) {
              a[i].checked = false;
            }
            break;
          case "type":
            $(v.all).get(0).checked = "checked";
            $(v.some).get(0).value = _initialTypes;
            break;
          case "orderBy":
            le = (a = $(v.options).get()).length;
            b = $(v.bools).get();
            for(i = 0; i < le; i++) {
              //  Default to order by time ascending, only.
              _selectValue(a[i], i ? "" : "time");
              b[i].checked = i ? false : "checked";
            }
            break;
          default: // text fields
            $(v).get(0).value = "";
        }
      }
    }
    o = _selectors.orderBy;
    le = (a = $(o.options).get()).length;
    b = $(o.bools).get();
    for(i = 0; i < le; i++) {
      //  Default to order by time ascending, only.
      _selectValue(a[i], i ? "" : "time");
      b[i].checked = i ? false : "checked";
    }

    //  If adhoc and has origin, clear origin.
    if(_.mode === "adhoc" && $(_selectors.filter.origin).get(0).value) {
      $(_selectors.filter.origin).get(0).value = "";
      $("#log_filter_title_display").html(
        Drupal.t("Ad hoc")
      );
    }
    else if(_.mode === "stored") {
      _setMode("adhoc");
    }
  };


  _controlRelay = function() {
    var nm = this.name;
    switch(nm) {
      case "log_filter_reset":
        _resetCriteria();
        break;
      case "log_filter_create":
        break;
      case "log_filter_copy":
        break;
      case "log_filter_edit":
        break;
      case "log_filter_delete":
        if ($(_selectors.filter.name).get(0).value) {
          $(_selectors.settings.mode).get(0).value = "delete";
          _resetCriteria();
          $(_selectors.buttons.submit).trigger("click");
        }
        break;
      case "log_filter_save":
        break;
      default:
        inspect.console("Unsupported button name[" + nm + "]");
    }
    return false; // For IE8's sake.
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

  this.inspect = function() {
    inspect(_, "LogFilter");
  };

  /**
   *
   *
   *  Options:
   *  - (int) x
   * @function
   * @name LogFilter.init
   * @param {obj} [options]
   * @return {void}
   */
  this.init = function(options) {
    var a, le, i, elm, type, jq, v;
    if(_init) {
      return;
    }
    _init = true;







    _prepareForm();



    _resize();
    $(window).resize(_resize);
  };
};

window.LogFilter = new LogFilter($);

})(jQuery);