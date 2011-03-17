/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Sync on Exit.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Richard Newman <rnewman@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */


const MODULE_ID = "{6f2e6de5-01a4-402c-b40e-fc42193ccff5}";
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/AddonManager.jsm");

function getCategoryManager() {
  return Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
}

function getObserverService() {
  return Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
}

function getSyncService() {
  try {
    let bsp = Cu.import("resource://services-sync/service.js");
    if (bsp) {
      getSyncService = function() bsp.Service;
      return bsp.Service;
    }
    throw "Could not import Sync code.";
  } catch (ex) {
    // Oh well.
    return null;
  }
}

function doSync() {
  let service = getSyncService();
  if (service) {
    try {
      service._log.info("Syncing on exit...");
      service.sync();
      service._log.info("Sync completed. Exiting.");
    } catch (ex) {
      // Oh well.
    }
  }
}

function SyncOnExitObserver() {
  this.register();
}

SyncOnExitObserver.prototype = {
  observe: function(subject, topic, data) {
    switch (topic) {
      case "weave:service:ready":
        let obs = getObserverService();
        obs.addObserver(this, "quit-application-granted", false);
        break;
      case "weave:service:logout:finish":
        this.removeQuietly("quit-application-granted");
        break;
      case "quit-application-granted":
        doSync();
        break;
    }
  },
  
  removeQuietly: function(p) {
    try {
      getObserverService().removeObserver(this, p);
    } catch (ex) {}
  },

  register: function() {
    let obs = getObserverService();
    obs.addObserver(this, "weave:service:ready", false);
    obs.addObserver(this, "weave:service:logout:finish", false);
    
    // Note that we don't actually listen if we're installed mid-run!
  },
  
  unregister: function() {
    this.removeQuietly("weave:service:ready");
    this.removeQuietly("weave:service:logout:finish");
    this.removeQuietly("quit-application-granted");
  }
}


var exitObserver;

/**
 * Handle the add-on being activated on install/enable.
 */
function startup(data, reason) {
  exitObserver = new SyncOnExitObserver();
}

/**
 * Handle the add-on being deactivated on uninstall/disable.
 */
function shutdown(data, reason) {
  exitObserver.unregister();
}

/**
 * Handle the add-on being installed.
 */
function install({id}, reason) AddonManager.getAddonByID(id, function(addon) {
  // Ensure enabled script: auto-enable on install.
  addon.userDisabled = false;
})

/**
 * Handle the add-on being uninstalled.
 */
function uninstall(data, reason) {}
