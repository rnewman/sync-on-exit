/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
      let service = bsp.Service;
      getSyncService = function() {
        return service;
      };
      return service;
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
        getSyncService()._log.info("Sync ready: added quit observer for sync-on-exit.");
        break;
      case "weave:service:logout:finish":
        this.removeQuietly("quit-application-granted");
        break;

      // We do our work on quit, rather than a more sophisticated scheme (such
      // as canceling a quit, syncing, then quitting on completion) because...
      // I don't see a way to quit!
      // This does, however, mean we spin the event loop inside the quit
      // observer. Not good. Use at your own risk.
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
    // Try and see.
    let scope = {};
    try {
      Cu.import("resource://services-sync/service.js", scope);
      let service = scope.Service;
      if (service && service.status && service.status.ready) {
        service._log.info("Sync already up and running: added quit observer for sync-on-exit.");
        obs.addObserver(this, "quit-application-granted", false);
      }
    } catch (ex) {
      // Oh well.
    }
  },

  unregister: function() {
    this.removeQuietly("weave:service:ready");
    this.removeQuietly("weave:service:logout:finish");
    this.removeQuietly("quit-application-granted");
  },
}

let exitObserver;

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
function install({id}, reason) {
  return AddonManager.getAddonByID(id, function(addon) {
    // Ensure enabled script: auto-enable on install.
    addon.userDisabled = false;
  });
}

/**
 * Handle the add-on being uninstalled.
 */
function uninstall(data, reason) {
}
