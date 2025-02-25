
var back = chrome.extension.getBackgroundPage();
var DeviceUIEventHandler = function () {

	this.onStatusReceived = function (status) {
		if (!status) {
			return;
		}
		var gcmStatus = status.gcmStatus;
		if (!gcmStatus) {
			return;
		}
		if (!selectedDeviceElement || !selectedDeviceElement.device) {
			return;
		}
		var device = null;
		var deviceElements = document.querySelectorAll("#device.device");
		console.log(deviceElements);
		var deviceElement = null;
		for (deviceElement of deviceElements) {
			if (deviceElement.device.deviceId == gcmStatus.deviceId) {
				device = deviceElement.device;
				break;
			}
		}
		if (!device || !device.deviceId) {
			return;
		}
		var status = gcmStatus.status;
		if (!status) {
			return;
		}
		UtilsDevices.showBatteryInfo(device, deviceElement.querySelector("#deviceicon"), status);


	}
}
var deviceUIEventHandler = new DeviceUIEventHandler();
back.eventBus.register(deviceUIEventHandler);

var deviceIdsToGetStatus = UtilsDevices.getDevices() ? UtilsDevices.getDevices().where(device => UtilsDevices.canReportStatus(device)).select(device => device.deviceId) : [];
var requestedStatus = false;
addEventListener("unload", function (event) {
	back.console.log("Unloading device UI...");
	back.eventBus.unregister(deviceUIEventHandler);

})

var selectedDeviceElement = null;
var isWritingDevices = false;
var writeDevices = async function () {
	if (isWritingDevices) return;

	isWritingDevices = true;
	const devices = await UtilsDevices.getDevices();
	try {
		var commandContainerElement = document.getElementById("devices");
		commandContainerElement.innerHTML = "";
		var deviceCommandsHtml = await importComponent('../components/device-commands.js');
		var deviceHtml = await importComponent('../components/device.js', '#device');
		var deviceButtonHtml = await importComponent('../components/device-button.js', '#devicebutton');
		var deviceButtonsHtml = await importComponent('../components/device-buttons.js', '#devicebuttons');
		var buttonsElement = null;
		if (!devices) {
			return;
		}
		var selectedDevice = devices.first(device => device.deviceId == localStorage.lastHoveredDeviceId);

		var deviceHover = function (e) {
			var element = e.target;
			if (!element) {
				return;
			}
			while (!element.device) {
				element = element.parentElement;
			}
			deviceElements.doForAll(function (deviceElement) {
				deviceElement.classList.remove("selecteddevice");
			});
			element.classList.add("selecteddevice");
			selectedDeviceElement = element;
			selectedDevice = element.device;
			localStorage.lastHoveredDeviceId = element.device.deviceId;
			if (!requestedStatus) {
				//gcmStatus.send(deviceIdsToGetStatus);
				requestedStatus = true;
			}
			for (var i = 0; i < buttonsElement.children.length; i++) {
				var buttonElement = buttonsElement.children[i];
				var command = buttonElement.command;
				var enabled = true;
				if (selectedDevice.deviceType == DEVICE_TYPE_GROUP) {
					var groupId = selectedDevice.deviceId.substring(6);
					var group = joindevices.groups.deviceGroups.allDeviceGroups.first(function (group) {
						return group.id == groupId;
					});
					if (group) {
						var groups = command.showForGroups;
						if (groups && groups.indexOf(group) >= 0) {
							enabled = true;
						} else {
							enabled = false;
						}
					}
				} else {
					if (command.condition) {
						if (!command.condition(selectedDevice)) {
							enabled = false;
						}
					}
				}
				if (enabled) {
					buttonElement.className = buttonElement.className.replace("disabled", "");
				} else {
					buttonElement.classList.add("disabled");
				}
			};
		}

		var deviceCommandsElement = deviceCommandsHtml.querySelector("#devicecommands").cloneNode(true);
		const currentTab = await back.getCurrentTabPromise();
		if (currentTab && currentTab.url.indexOf(DEVICES_POPUP_URL) == 0) {
			deviceCommandsElement.className = "devicecommandsleft";
		}



		var deviceElements = [];
		commandContainerElement.appendChild(deviceCommandsElement);
		deviceCommandsElement.innerHTML = "";
		var devicesElement = deviceCommandsHtml.querySelector("#devicelist").cloneNode(true);
		deviceCommandsElement.appendChild(devicesElement);
		for (var i = 0; i < devices.length; i++) {
			var device = devices[i];
			if (await UtilsDevices.isHidden(device)) {
				continue;
			}
			var deviceElement = deviceHtml.cloneNode(true);
			deviceElement.onclick = deviceHover;
			deviceElement.device = device;
			deviceElement.querySelector("#devicename").textContent = device.deviceId == localStorage.deviceId ? "This device" : device.deviceName;
			var iconGetter = deviceImages["" + device.deviceType];
			if (!iconGetter) continue;

			var deviceIcon = iconGetter(device);
			if (!deviceIcon && device.deviceType == DEVICE_TYPE_GROUP) {
				deviceIcon = device.deviceId.substring(6) + ".png";
			}
			var imageElement = deviceElement.querySelector("#deviceicon");
			var imageInfoElement = deviceElement.querySelector("#deviceinfoicon");
			if (UtilsDevices.canReportStatus(device)) {
				imageInfoElement.onclick = e => {
					var device = UtilsDom.findParent(e.target, element => element.device ? true : false).device;
					console.log(device);
					Dialog.showDeviceInfoDialog({
						deviceId: device.deviceId
					}, {
						shouldShow: true
					})();
				}
			} else {
				imageInfoElement.classList.add("hidden");
			}
			var imageLocalNetworkElement = deviceElement.querySelector("#devicelocalnetworkicon");
			if (UtilsDevices.canContactViaLocalNetwork(device)) {
				imageLocalNetworkElement.classList.remove("hidden");
			} else {
				imageLocalNetworkElement.classList.add("hidden");
			}
			imageElement.src = "icons/" + deviceIcon;
			devicesElement.appendChild(deviceElement);
			deviceElements.push(deviceElement);
		};


		var findButtonElement = function (e) {
			if (e.commandLink) {
				return e;
			}
			var target = e.target;
			while (!target.commandLink) {
				target = target.parentElement;
			}
			return target;
		}
		// var highlightColor = "#FF9800";
		// var lowlightColor = "#757575";
		// var setButtonColor = function(e, color){
		// 	var buttonElement = findButtonElement(e);
		// 	tintImage(buttonElement.commandImage,color);
		// 	buttonElement.commandLink.style.color = color;
		// }
		// var buttonHover = function(e){
		// 	setButtonColor(e,highlightColor);
		// };
		// var buttonHoverOut = function(e){
		// 	setButtonColor(e,lowlightColor);
		// };
		var buttonClick = async function (e) {
			var link = findButtonElement(e);
			/*if(link.command.condition && !link.command.condition(selectedDevice)){
				return;
			}*/

			const tab = await back.getCurrentTabPromise();
			if (!tab || isPopup) {
				await link.command.func(selectedDevice.deviceId, await back.getShowInfoNotifications(), tab);
				if (tab && !link.command.keepTab && closeAfterCommand) {
					chrome.tabs.remove(tab.id, function () { });
				}
			} else {
				await link.command.func(selectedDevice.deviceId, back.getShowInfoNotifications());
			}
		}
		var buttonScroll = 0;
		var buttonDragStart = function (e) {
			//e.preventDefault();
			var buttonElement = findButtonElement(e);
			e.dataTransfer.setData("index", buttonElement.commandIndex);
			console.log(buttonElement);
		}
		var buttonDragDrop = async function (e) {

			if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				return;
			}
			var buttonScroll = commandsElement.scrollTop;
			//console.log(e.target);
			var buttonElement = findButtonElement(e);
			var oldIndex = e.dataTransfer.getData("index");
			var newIndex = buttonElement.commandIndex;
			var commandBeingDragged = null;
			var moveIndex = function (prop, index, value) {
				console.log(index + "=>" + (index + value));
				index = index + value;
				commandSortOrder[prop] = index;
			}
			var moveIndexForward = function (prop, index) {
				moveIndex(prop, index, 1);
			};
			var moveIndexBackward = function (prop, index) {
				moveIndex(prop, index, -1);
			};
			for (var prop in commandSortOrder) {
				var commandBeingDraggedIndex = commandSortOrder[prop];
				if (newIndex < oldIndex) {
					if (commandBeingDraggedIndex >= newIndex && commandBeingDraggedIndex < oldIndex) {
						moveIndexForward(prop, commandBeingDraggedIndex);
					}
				} else {
					if (commandBeingDraggedIndex <= newIndex && commandBeingDraggedIndex > oldIndex) {
						moveIndexBackward(prop, commandBeingDraggedIndex);
					}
				}
				if (commandBeingDraggedIndex == oldIndex) {
					commandBeingDragged = sortedDeviceCommands.first(function (command) {
						return command.commandId == prop;
					});
				}
			}
			console.log(commandBeingDragged);
			console.log("=>");
			console.log(buttonElement.command);
			commandSortOrder[commandBeingDragged.commandId] = newIndex;
			/*commandSortOrder[buttonElement.command.commandId] = oldIndex;*/
			storeDeviceCommandOrder();
			await writeDevices();
			document.querySelector("#commands").scrollTop = buttonScroll;
		}
		var allowDrop = function (e) {
			e.preventDefault();
		}
		var commandsElement = deviceCommandsHtml.querySelector("#commands").cloneNode(true);
		buttonsElement = deviceButtonsHtml.cloneNode(true);
		deviceCommandsElement.appendChild(commandsElement);
		commandsElement.appendChild(buttonsElement);
		var sortedDeviceCommands = sortDeviceCommands();
		var dropzoneElement = document.getElementById("dropzonedevices");
		var isButtonDrag = e => {
			if (!e.dataTransfer.items) {
				return false;
			}
			for (item of e.dataTransfer.items) {
				if (item.type == "index") {
					return true;
				}
			}
			return false;
		};
		commandsElement.ondragstart = e => {
			if (isButtonDrag(e)) {
				return;
			}
			back.console.log("Drag start");
			back.console.log(e);
		};
		commandsElement.ondragover = e => {
			if (isButtonDrag(e)) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			makeDropZoneReady(dropzoneElement)
				.then(files => {
					if (files) {
						pushFile(selectedDevice.deviceId, null, null, files)
					}
				});
		}
		/*var dropzoneElement = UtilsDom.createElement(commandsElement,"div","dropzone",{"class":"dropzone"});
		dropzoneElement.innerHTML = "Drop files here";*/
		for (var e = 0; e < sortedDeviceCommands.length; e++) {
			var command = sortedDeviceCommands[e];
			if (await back.getOptionValue("checkbox", command.commandId + "disable")) {
				continue;
			}
			var buttonElement = deviceButtonHtml.cloneNode(true);
			// buttonElement.onmouseover = buttonHover;
			// buttonElement.onmouseout = buttonHoverOut;
			var link = buttonElement.querySelector("#link");
			var image = buttonElement.querySelector("#devicebuttonimage");
			var dragImage = buttonElement.querySelector("#devicebuttondrag");
			//UtilsDom.replaceWithSvgInline(dragImage);
			handleDeviceCommandIcon(command, image);
			commandSortOrder[command.commandId] = e;
			link.textContent = command.label;
			buttonElement.onclick = buttonClick;
			buttonElement.command = command;
			buttonElement.commandLink = link;
			buttonElement.commandImage = image;
			buttonElement.commandIndex = e;
			buttonElement.ondragstart = buttonDragStart;
			buttonElement.ondragover = allowDrop;
			buttonElement.ondrop = buttonDragDrop;
			buttonsElement.appendChild(buttonElement);
		};
		var lastHoveredDevice = UtilsDevices.getDevices().first(function (device) {
			return device.deviceId == localStorage.lastHoveredDeviceId;
		});
		if (lastHoveredDevice) {
			deviceHover({ "target": deviceElements.first(function (deviceElement) { return deviceElement.device.deviceId == localStorage.lastHoveredDeviceId; }) });
		} else {
			deviceHover({ "target": deviceElements[0] });
		}

	} finally {
		isWritingDevices = false;
	}

}
document.addEventListener('DOMContentLoaded', async function () {
	await writeDevices();
	//	setDeviceCommandHeight();
});
