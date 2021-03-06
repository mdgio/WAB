///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dojo/_base/array',
  'jimu/BaseWidgetSetting'
],
function(declare, array, BaseWidgetSetting) {

  return declare([BaseWidgetSetting], {
    baseClass: 'jimu-widget-adddata-setting',

    postCreate: function(){
      //the config object is passed in
      this.setConfig(this.config);
    },

    setConfig: function(config){
		this.config = config;
		this.titleOfRoot.value = config.titleOfRoot;
		this.externalURL.value = config.referenceURLs.externalURL;
        //get location for the config file
		if (this.config.URLLocation == "doitHosted") {
            //hosted at doit and updated regularly
			this.urlDoIT.checked = true;
		} else if (this.config.URLLocation == "doitHosted") {
            //external url 
			this.urlExternal.checked = true;
		} else {
            //local file kept in layerList folder
			this.urlLocal.checked = true;
		}
    },

    getConfig: function(){
		//WAB will get config object through this method
		this.config.titleOfRoot = this.titleOfRoot.value;
		if (this.urlDoIT.checked) {
			this.config.URLLocation = "doitHosted";		
		} else if (this.urlExternal.checked) {
			this.config.URLLocation = "externalURL";
			this. config.referenceURLs.externalURL = this.externalURL.value;
		} else {
			this.config.URLLocation = "localPath";
		}
		return this.config;
    }
  });
});