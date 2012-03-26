// (c) 2012 Kyle Graehl / Patrick Williams, BitTorrent Inc.
// Btapp may be freely distributed under the MIT license.
// For all details and documentation:
// http://pwmckenna.github.com/btapp

(function() {

    function assert(b, err) { if(!b) throw err; }

    //utility function to wait for some condition
    //this ends up being helpful as we toggle between a flow chart and a state diagram
    function when(condition, functionality, interval) {
        var when_func = function() {
            if(condition.call()) {
                functionality.call();
            } else {
                setTimeout(when_func, interval || 500);
            }
        };
        _.defer(when_func);
    }

    PluginManager = Backbone.Model.extend({
        //Avoid DOM collisions by having a ridiculous id.
        PID: 'btapp_plugin_' + Math.floor(Math.random() * 1024),
        //All BitTorrent products have this number appended to their window names
        WINDOW_HASH: '4823',
        DEFAULT_PRODUCT:'SoShare',
        MIME_TYPE: 'application/x-gyre-soshare',
        ACTIVEX_PROGID: 'gyre.soshare',

        initialize: function() {
            _.bindAll(this);
            this.PRODUCT = this.get('product') || this.DEFAULT_PRODUCT;
            //when we load jquery, we should defer a call to mime_type_check
            jQuery(_.bind(_.defer, this, this.mime_type_check));
        },


        //we know nothing. we want:
        //the plugin installed
        //the client installed
        //the client running
        mime_type_check: function() {
            if(this.supports_mime_type()) {
                this.mime_type_check_yes();
            } else {
                this.mime_type_check_no();
            }
        },
        mime_type_check_no: function() {
            var switches = {'install':true};
            this.trigger('plugin:install_plugin', switches);
            if(switches.install) {
                this.show_install_plugin_dialog();
                when(this.supports_mime_type, this.mime_type_check_yes);
            }
        },
        mime_type_check_yes: function() {
            this.trigger('plugin:plugin_installed');
            this.add_plugin(_.bind(function() {
                this.trigger('plugin:plugin_running');
                this.client_installed_check();
            }, this));
        },

        //the plugin is installed. good.
        client_installed_check: function() {
            if(this.client_installed()) {
                this.client_installed_check_yes();
            } else {
                this.client_installed_check_no();
            }
        },
        client_installed_check_no: function() {
            var switches = {'install':true};
            this.trigger('plugin:install_client', switches);
            if(switches.install) {
                this.get_plugin().downloadProgram(this.PRODUCT, _.bind(function(a,b,c,d,key) {
                    jQuery.jStorage.set('pairing_key', key);
                    this.trigger('plugin:downloaded_client');
                }, this));
                when(this.client_installed, this.client_installed_check_yes);
            }
        },
        client_installed_check_yes: function() {
            this.trigger('plugin:client_installed');
            this.client_running_check();
        },

        //the client is installed. good. 
        client_running_check: function() {
            if(this.client_running()) {
                this.client_running_check_yes();
            } else {
                this.client_running_check_no();
            }
        },
        client_running_check_no: function() {
            this.get_plugin().runProgram(this.PRODUCT, function() {});
            when(this.client_running, this.client_running_check_yes);
        },
        client_running_check_yes: function() {
            //well i'll be...looks like we made it to the end.
            this.trigger('plugin:client_running');
        },


        // Plugin Specific Functionality
        // ---------------------------
        supports_mime_type: function() {
            var isIE  = (navigator.appVersion.indexOf("MSIE") != -1) ? true : false;
            if(isIE) {
                try {
                    var tq = new ActiveXObject(this.ACTIVEX_PROGID);
                    return tq !== undefined;
                } catch (e) {
                    return false;
                }
            } else {
                navigator.plugins.refresh();

                for (var i = 0; i < navigator.plugins.length; i++) {
                    var plugin = navigator.plugins[i][0];
                    if (plugin.type == this.MIME_TYPE) {
                        return true;
                    }
                }
            }
        },
        get_plugin: function() {
            var ret = document.getElementById(this.PID);
            assert(ret, 'cannot call get_plugin before adding the plugin');
            return ret;
        },
        plugin_loaded: function() {
            assert(this.supports_mime_type(), 'you have not installed the plugin yet')
            assert(jQuery('#' + this.PID).length !== 0, 'you have not yet added the plugin');
            return get_plugin().version;
        },
        add_plugin: function(cb) {
            assert(this.supports_mime_type(), 'you have not installed the plugin yet')
            assert(jQuery('#' + this.PID).length === 0);
            var obj = document.createElement('object');
            var onload = this.PID + 'onload';
            window[onload] = cb;
            var div = document.createElement('div');            
            jQuery(div).css({'position':'absolute','left':'-999em'});
            div.innerHTML =
                '<object id="' + this.PID + '" type="' + this.MIME_TYPE + '" width="0" height="0">' +
                    '<param name="onload" value="' + onload + '" />' +
                '</object>';

            document.body.appendChild(div);
        },  
        remove_plugin: function() {
            jQuery('#btapp_plugin').remove();
        },



        // Client Specific Functionality
        // ---------------------------
        // Lets ask the plugin if the specific client is running.
        client_running: function() {
            var clients = this.get_plugin().isRunning(this.PRODUCT + this.WINDOW_HASH);
            var running = clients && clients.length > 0;
            return running;
        },
        client_installed: function() {
            var version = this.get_plugin().getInstallVersion(this.PRODUCT);
            var not_supported = 'This application is not supported.';
            assert(version !== not_supported, not_supported);
            return version;
        }
    });
}).call(this);