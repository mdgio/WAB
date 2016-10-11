define(['dojo/_base/declare',
    'jimu/BaseWidget',
    "dojo/_base/lang",
    "dojo/store/Memory",
    "dijit/tree/ObjectStoreModel",
    'jimu/LayerInfos/LayerInfos',
    "dijit/Tree",
    "dojo/dom-construct",
    "dijit/TooltipDialog",
    'dojo/_base/array',
    'dojo/Deferred',
    "dijit/registry",
    "dijit/popup",
    "dojo/on",
    'dojo/promise/all',
    "dojo/_base/connect",
    "dijit/form/Button",
    "dijit/layout/ContentPane"],
function(declare, BaseWidget, lang, Memory, ObjectStoreModel, LayerInfos, Tree, domConstruct,
    TooltipDialog, array, Deferred, registry, popup, on, all, connect, Button, ContentPane) {
  //To create a widget, you need to derive from BaseWidget.
  return declare([BaseWidget], {
    // Custom widget code goes here 
	
    baseClass: 'jimu-widget-addimapdata',
    name: 'AddiMAPData',
	
	//methods to communication with app container:

    postCreate: function() {
       this.inherited(arguments);
       console.log('postCreate');
    },

    startup: function() {
		//this.inherited(arguments);
        var urlPath = "";
        //figure out where the json file will be pointing towards
		switch (this.config.URLLocation){
			case "localPath":
				urlPath = this.config.referenceURLs.localPath;
				break;
			case "doitHosted":
				urlPath = this.config.referenceURLs.doitHosted;
				break;
			case "externalURL":
				urlPath = this.config.referenceURLs.externalURL;
				break;
			default:
				urlPath = this.config.referenceURLs.localPath;				
		}

		var jsonRequest = esri.request({
			url: urlPath,
			handleAs: "text",
			callbackParamName: "callback"
		});
		jsonRequest.then( // Use lang.hitch to have the callbacks run in the scope of this module
			lang.hitch(this, function (jsonResponse) { //The response should be a JSON object in the dijit/tree format required
				
				//strip out comment text
				if (jsonResponse.indexOf("/*") > -1){
					jsonResponse = jsonResponse.replace(jsonResponse.substr(jsonResponse.indexOf("/*"), jsonResponse.indexOf("*/") + 2), "");
				}
				//parse the json
				jsonResponse = JSON.parse(jsonResponse.toString());
				
				var newTree = { index: 0 };
				// set up the store to get the tree data
				newTree.store = new Memory({
					data: [jsonResponse],
					getChildren: function (object) {
						return object.children || [];
					}
				});
				// set up the model, assigning store, and assigning method to identify leaf nodes of tree
				newTree.model = new ObjectStoreModel({
					store: newTree.store,
					query: { id: 'root' },
					mayHaveChildren: function (item) {
						return "children" in item;
					}
				});
				// create the tree
				newTree.tree = new Tree({
					showRoot: false,
					getIconClass: function (/*dojo.store.Item*/item, /*Boolean*/opened) {
						return (!item || this.model.mayHaveChildren(item)) ? (opened ? "mapFolderOpen" : "dijitFolderClosed") : "mapLeaf"
					},
					model: newTree.model,
					onOpenClick: true,
					onClick: lang.hitch(this, function (item, node, evt) { // When a node is clicked, open the tooltip
						this._selectedItem = null;
						this._selectedNode = null;
						if (this._toolTipDialog) //clear the old contents of the description
							this._toolTipDialog.descriptionPane.set('content', '<p></p>');
						popup.close(this._toolTipDialog);
						if (item.type) { //make sure its a service node and not a folder node
							this._selectedItem = item;
							this._selectedNode = node;
							this._showServiceTooltip(item, node);
						}
					})
				});
				domConstruct.place(newTree.tree.domNode, this.layerListNode, "first");

				LayerInfos.getInstance(this.map, this.map.itemInfo).then(lang.hitch(this, function (layerInfosObj) {
				    this.own(layerInfosObj.on(
                      'layerInfosChanged',
                      lang.hitch(this, this.onLayerInfosChanged)));
				}));
			})
		);

		console.log('startup');
	},
	_showServiceTooltip: function (item, node) {
		if (!this._toolTipDialog) { //Create a single tooltipdialog to be re-used for all selected nodes
			this._toolTipDialog = new TooltipDialog({
				"id": 'addDataTooltipDialog',
				"class": "tipDialog"
			});
			this._toolTipDialog.startup();
			var addBtn = new Button({
				label: "Add"
					, iconClass: "toolTipAddBtn"
					, style: "margin: 0px 10px 0px 0px;"
					, onClick: lang.hitch(this, function () { //Close the popup and call the fxn that adds the service to the map
						popup.close(this._toolTipDialog);
						this._addServiceToMap();
					})
			});
			var closeBtn = new Button({
				label: "Close"
					, iconClass: "toolTipCloseBtn"
					, onClick: lang.hitch(this, function () { //Close the popup
						popup.close(this._toolTipDialog);
					})
			});
			var descPane = new ContentPane({ //Service description will go in here
				"class": 'tipDialogCont'
			});
			this._toolTipDialog.addChild(addBtn);
			this._toolTipDialog.addChild(closeBtn);
			this._toolTipDialog.addChild(descPane);
			this._toolTipDialog.descriptionPane = descPane;
		}
		//Now show the popup
		if (item.type === "MapServer" || item.type === "ImageServer" || item.type === "Feature Layer") {
			popup.open({
				popup: this._toolTipDialog,
				around: node.domNode
			});
			//If selected node's serviceinfo has not been retrieved for this node, go get it
			if (!node.serviceInfo) {
				var jsonRequest = esri.request({
					url: item.url + "?f=json",
					content: { f: "json" },
					handleAs: "json",
					callbackParamName: "callback",
					timeout: 10000
				});
				// Use lang.hitch to have the callbacks run in the scope of this module
				jsonRequest.then(
						lang.hitch(this, function (jsonResponse) { //The response should be a JSON object in the dijit/tree format required
							//Append service information to node, so it will have it. Also create links in the service description.
							node.serviceInfo = jsonResponse;
							if (node.serviceInfo.serviceDescription) {
								node.serviceInfo.hasCreatedLinks = true;
							} else if (node.serviceInfo.description) {
								node.serviceInfo.hasCreatedLinks = true;
							}
							this._toolTipDialog.descriptionPane.set('content', '<p>' + (node.serviceInfo.serviceDescription || node.serviceInfo.description) + '</p>');
						}), lang.hitch(this, function (error) {
							this._toolTipDialog.descriptionPane.set('content', '<p>Could not load description.</p>');
						})
					);
			} else //Already have serviceinfo for the selected node, so display it
				this._toolTipDialog.descriptionPane.set('content', '<p>' + (node.serviceInfo.serviceDescription || node.serviceInfo.description) + '</p>');
		} else if (item.type === "KML" || item.type === "WMS") { //Don't try and get descriptions. Just set to type
			if (!node.serviceInfo)
				node.serviceInfo = { serviceDescription: item.type }
			this._toolTipDialog.descriptionPane.set('content', '<p>' + node.serviceInfo.serviceDescription + '</p>');
			popup.open({
				popup: this._toolTipDialog,
				around: node.domNode
			});
		} else
			alert("This layer type is not supported.");
	},

	_obtainMapLayers: function () {
		// summary:
		//    obtain basemap layers and operational layers if the map is not webmap.
		var retObj = [];

		array.forEach(this.map.graphicsLayerIds, function (layerId) {
			retObj.push(layerId);
		}, this);
		array.forEach(this.map.layerIds, function (layerId) {
			retObj.push(layerId);
		}, this);

		return retObj;
	},

	_addServiceToMap: function () {
		var item = this._selectedItem;
		var node = this._selectedNode;
		try {
			var layer;
			//get map layers to check if it already exists in the map
			var layers = this._obtainMapLayers();
			array.forEach(layers, lang.hitch(this, function (layer) {
				var chkLayer = this.map.getLayer(layer);
				if (chkLayer.url && chkLayer.url == item.url) {
					throw new Error("This layer already exists in the map.");
				}
			}));

			if (item.type === "MapServer") {
				//Check if map service is cached, if so, check if wkid matches map's wkid. If so, add as tiled layer.
				if (node.serviceInfo && node.serviceInfo.singleFusedMapCache == true && node.serviceInfo.spatialReference.wkid == this.map.spatialReference.wkid)
					layer = esri.layers.ArcGISTiledMapServiceLayer(item.url);
				else //Otherwise add as dynamic layer
					layer = esri.layers.ArcGISDynamicMapServiceLayer(item.url);
			} else if (item.type === "ImageServer")
				layer = esri.layers.ArcGISImageServiceLayer(item.url);
			else if (item.type === "Feature Layer") {
				//Create a popup template for the feature layer - not implemented
				var strContent;
				//Creates a table of attributes for popup
				if (node.serviceInfo) {
					var contArray = ['<table>'];
					for (var s = 0; s < node.serviceInfo.fields.length; s++) {
						var name = node.serviceInfo.fields[s].name;
						if (name === 'objectid' || name === 'shape')
							continue;
						var alias = node.serviceInfo.fields[s].alias;
						contArray.push('<tr valign="top"><td class="attrName">' + alias + '</td><td class="attrValue">${' + name + '}</td></tr>');
					}
					contArray.push('</table>');
					strContent = contArray.join('');

					//Checks to see if a field named popup exists.  If so uses it instead of table created above
					for (var s = 0; s < node.serviceInfo.fields.length; s++) {
						var name = node.serviceInfo.fields[s].name;
						if (name === 'popup')
							strContent = "${popup}";
					}
				}
				var infoTemplate = new esri.InfoTemplate("Attributes", strContent);
				layer = esri.layers.FeatureLayer(item.url, { infoTemplate: infoTemplate, outFields: ["*"] });

			} else if (item.type === "KML")
				layer = esri.layers.KMLLayer(item.url);
			else if (item.type === "WMS")
				layer = esri.layers.WMSLayer(item.url);
			else {
				alert("This layer type is not supported.");
				return;
			}
			//Set the title for Legend to use.
			layer.title = item.name;
			//Take on the REST endpoint's serviceinfo JSON. Legend can then check for it and use it.
			layer.serviceInfo = node.serviceInfo;
			//Make sure the layer loads, or show the error, should be converted to layer's load event
			connect.connect(this.map, "onLayerAddResult", lang.hitch(this, function (layer, error) {
				if (error){
				    alert("Error occurred loading in map : " + error.message);
				}
			}));
			this.map.addLayer(layer);
		} catch (ex) {
			alert("Service could not be loaded in map : " + ex.message);
		}
	},

	onLayerInfosChanged: function(layerInfo, changeType, layerInfoSelf){
	    if (!layerInfoSelf || !layerInfo) {
	        return;
	    }
	    if ('added' === changeType) {
	        layerInfoSelf.getSupportTableInfo().then(lang.hitch(this, function (supportTableInfo) {
	            if (supportTableInfo.isSupportedLayer) {
	                this.publishData({
	                    'target': 'AttributeTable',
	                    'layer': layerInfoSelf
	                });
	            } else {
	                if (layerInfoSelf.newSubLayers.length > 0) {
	                    var supportQArray = [];
	                    for (var j = 0; j < layerInfoSelf.newSubLayers.length; j++) {

	                        if (layerInfoSelf.newSubLayers[j].newSubLayers.length == 0) {
	                            var subLayInfoSelf = layerInfoSelf.newSubLayers[j];
	                            supportQArray.push(supTableFunction(subLayInfoSelf));
	                        }
	                    }
	                    all(supportQArray).then(lang.hitch(this, function (results) {
	                        for (var l = 0; l < results.length; l++) {
	                            if (results[l].status == 'success' && results[l].result.isSupportedLayer) {
	                                this.publishData({
	                                    'target': 'AttributeTable',
	                                    'layer': results[l].layerInfo
	                                });
	                            }
	                        }

	                    }));
	                }
	                function supTableFunction(subLayInfoSelf) {
	                    var deferred = new Deferred();
	                    var layer = subLayInfoSelf;
	                    subLayInfoSelf.getSupportTableInfo().then(lang.hitch(this, function (result) {
	                        deferred.resolve({ status: 'success', layerInfo: layer, result: result });
	                    }), function (error) {
	                        deferred.resolve({ status: 'error' });
	                    });
	                    return deferred;

	                }
	            }
	        }));
	    } else if ('removed' === changeType) {
	        // do something
	    }
	},

    onClose: function(){
        this.ClosePopup();
    },

	ClosePopup: function () {
		if (this._toolTipDialog)
			popup.close(this._toolTipDialog);
	}

    // onOpen: function(){
    //   console.log('onOpen');
    // },

    // onClose: function(){
    //   console.log('onClose');
    // },

    // onMinimize: function(){
    //   console.log('onMinimize');
    // },

    // onMaximize: function(){
    //   console.log('onMaximize');
    // },

    // onSignIn: function(credential){
    //   /* jshint unused:false*/
    //   console.log('onSignIn');
    // },

    // onSignOut: function(){
    //   console.log('onSignOut');
    // }
      
    // onPositionChange: function(){
    //   console.log('onPositionChange');
    // },

    // resize: function(){
    //   console.log('resize');
    // }

//methods to communication between widgets:

  });
});