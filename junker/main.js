 'use strict';

var CRC2d = CanvasRenderingContext2D.prototype,
	{ api, meta, utils } = require('../libs/consts'),
	vars = require('../libs/vars');

vars.load(require('./vars'));

class Main {
	constructor() {
		global[vars.key] = this;
		
		this.utils = utils;
		
		this.settings = null;

		this.css = {
			hideAdverts: `#aContainer, #aHolder, #endAContainer, #aMerger { display: none !important; }`,
			noTextShadows: `*, .button.small, .bigShadowT { text-shadow: none !important; }`,
		};

		this.tabs = ['Render','Weapon','Player','GamePlay','Radio','Dev'];

		this.downKeys = new Set();
		this.nameTags = undefined;
		
		this.eventHandlers();
		
		this.discord = { guild: {} };
		
		fetch(new URL('code.txt', meta.discord), { cache: 'no-store' }).then(async res => {
			var code = await res.text();
			
			this.discord.code = code;
			
			Object.assign(this.discord, await(await fetch(`https://discord.com/api/v8/invites/${code}?with_counts=true`)).json());
		});
		
		var tokenPromise = api.token();
		
		api.source().then(source => {
			this.gameLoad(source, tokenPromise);
			this.createSettings();
			this.gameHooks();
		});
	}
	onInput(input) {
		if (!this.settings || !utils.isDefined(this.me)) return input;
		let isMelee = utils.isDefined(this.me.weapon.melee)&&this.me.weapon.melee||utils.isDefined(this.me.weapon.canThrow)&&this.me.weapon.canThrow;
		let ammoLeft = this.me[vars.ammos][this.me[vars.weaponIndex]];

		// autoReload
		if (this.settings.autoReload.val) {
			//let capacity = this.me.weapon.ammo;
			//if (ammoLeft < capacity)
			if (isMelee) {
				if (!this.me.canThrow) {
					//this.me.refillKnife();
				}
			} else if (!ammoLeft) {
				this.game.players.reload(this.me);
				input[vars.keys.reload] = 1;
				// this.me[vars.reloadTimer] = 1;
				//this.me.resetAmmo();
			}
		}

		//Auto Bhop
		if (this.settings.autoBhop.val && this.settings.autoBhop.val !== "off") {
			if (this.downKeys.has("Space") || this.settings.autoBhop.val == "autoJump" || this.settings.autoBhop.val == "autoSlide") {
				this.controls.keys[this.controls.binds.jump.val] ^= 1;
				if (this.controls.keys[this.controls.binds.jump.val]) {
					this.controls.didPressed[this.controls.binds.jump.val] = 1;
				}
				if (this.downKeys.has("Space") || this.settings.autoBhop.val == "autoSlide") {
					if (this.me[vars.yVel] < -0.03 && this.me.canSlide) {
						setTimeout(() => {
							this.controls.keys[this.controls.binds.crouch.val] = 0;
						}, this.me.slideTimer||325);
						this.controls.keys[this.controls.binds.crouch.val] = 1;
						this.controls.didPressed[this.controls.binds.crouch.val] = 1;
					}
				}
			}
		}

		//Autoaim
		if (this.settings.autoAim.val !== "off") {
			this.ray.setFromCamera(this.vec2, this.renderer.fpsCamera);
			const playerMaps = []
			let target = null, targets = this.game.players.list.filter(enemy => {
				let hostile = undefined !== enemy[vars.objInstances] && enemy[vars.objInstances] && !enemy[vars.isYou] && !this.getIsFriendly(enemy) && enemy.health > 0 && this.getInView(enemy);
				if (hostile) playerMaps.push( enemy[vars.objInstances] );
				return hostile
			})

			if (this.settings.fovBoxSize.val !== 'off') {
				let scaledWidth = this.ctx.canvas.width / this.scale;
				let scaledHeight = this.ctx.canvas.height / this.scale;
				for (let i = 0; i < targets.length; i++) {
					const t = targets[i];
					const sp = this.world2Screen(new this.three.Vector3(t.x, t.y, t.z), scaledWidth, scaledHeight, t.height / 2);
					let fovBox = null;
					switch (this.settings.fovBoxSize.val) {
						case 'large':
							fovBox = [scaledWidth / 3, scaledHeight / 4, scaledWidth * (1 / 3), scaledHeight / 2]
							break;
							// medium
						case 'medium':
							fovBox = [scaledWidth * 0.4, scaledHeight / 3, scaledWidth * 0.2, scaledHeight / 3]
							break
							// small
						case 'small':
							fovBox = [scaledWidth * 0.45, scaledHeight * 0.4, scaledWidth * 0.1, scaledHeight * 0.2]
							break
					}
					if (sp.x >= fovBox[0] && sp.x <= (fovBox[0] + fovBox[2]) && sp.y >= fovBox[1] && sp.y < (fovBox[1] + fovBox[3])) {
						target = targets[i]
						break
					}
				}
			}

			else target = targets.sort((p1, p2) => this.getD3D(this.me.x, this.me.z, p1.x, p1.z) - this.getD3D(this.me.x, this.me.z, p2.x, p2.z)).shift();

			if (target) {
				let obj = target[vars.objInstances];
				let pos = obj.position.clone();
				let yDire = (this.getDir(this.me.z, this.me.x, pos.z||target.z, pos.x||target.x) || 0) * 1000;
				let xDire = ((this.getXDire(this.me.x, this.me.y, this.me.z, pos.x||target.x, pos.y||target.y - target[vars.crouchVal] * vars.consts.crouchDst + this.me[vars.crouchVal] * vars.consts.crouchDst + this.settings.aimOffset.val, pos.z||target.z) || 0) - vars.consts.recoilMlt * this.me[vars.recoilAnimY]) * 1000;
				let inCast = this.ray.intersectObjects(playerMaps, true).length//this.ray.intersectObjects(this.game.map.objects, true, obj) == obj;

				let vis = pos.clone();
				vis.y += vars.consts.playerHeight + vars.consts.nameOffset - (target[vars.crouchVal] * vars.consts.crouchDst);
				if (target.hatIndex >= 0) vis.y += vars.consts.nameOffsetHat;
				let dstDiv = Math.max(0.3, (1 - (this.getD3D(this.me.x, this.me.y, this.me.z, vis.x, vis.y, vis.z) / 600)));
				let fSize = (20 * dstDiv);
				let visible = (fSize >= 1 && this.containsPoint(vis));

				if (this.me.weapon[vars.nAuto] && this.me[vars.didShoot]) {
					input[vars.keys.shoot] = 0;
					input[vars.keys.scope] = 0;
					this.me.inspecting = false;
					this.me.inspectX = 0;
				}
				else if (!visible && this.settings.frustrumCheck.val) this.resetLookAt();
				else if (ammoLeft||isMelee) {
					//input[vars.keys.scope] = this.settings.autoAim.val === "assist" || this.settings.autoAim.val === "correction" || this.settings.autoAim.val === "trigger" ? this.controls[vars.mouseDownR] : 0;
					switch (this.settings.autoAim.val) {
						case "quickScope":
							input[vars.keys.scope] = (!visible && this.settings.frustrumCheck.val)?0:1;
							if (!this.me[vars.aimVal]||this.me.weapon.noAim) {
								if (!this.me.canThrow||!isMelee) {
									this.lookDir(xDire, yDire);
									input[vars.keys.shoot] = 1;
								}
								input[vars.keys.ydir] = yDire
								input[vars.keys.xdir] = xDire
							}
							break;
						case "assist": case "easyassist":
							if (input[vars.keys.scope] || this.settings.autoAim.val === "easyassist") {
								if (!this.me.aimDir && visible || this.settings.autoAim.val === "easyassist") {
									if (!this.me.canThrow||!isMelee) {
										this.lookDir(xDire, yDire);
									}
									if (this.settings.autoAim.val === "easyassist" && this.controls[vars.mouseDownR]) input[vars.keys.scope] = 1;
									input[vars.keys.ydir] = yDire
									input[vars.keys.xdir] = xDire
								}
							}
							break;
						case "silent":
							input[vars.keys.scope] = (!visible && this.settings.frustrumCheck.val)?0:1;
							if (!this.me[vars.aimVal]||this.me.weapon.noAim) {
								if (!this.me.canThrow||!isMelee) input[vars.keys.shoot] = 1;
							} else input[vars.keys.scope] = 1;
							input[vars.keys.ydir] = yDire
							input[vars.keys.xdir] = xDire
							break;
						case "trigger":
							if (input[vars.keys.scope] && inCast) {
								input[vars.keys.shoot] = 1;
								input[vars.keys.ydir] = yDire
								input[vars.keys.xdir] = xDire
							}
							break;
						case "correction":
							if (input[vars.keys.shoot] == 1) {
								input[vars.keys.ydir] = yDire
								input[vars.keys.xdir] = xDire
							}
							break;
						default:
							this.resetLookAt();
							break;
					}
				}
			} else {
				this.resetLookAt();
			}
		}
		
		return input;
	}

	onRender() {
		let main = this;
		let scaledWidth = this.ctx.canvas.width / this.scale;
		let scaledHeight = this.ctx.canvas.height / this.scale;
		let playerScale = (2 * vars.consts.armScale + vars.consts.chestWidth + vars.consts.armInset) / 2
		let worldPosition = this.renderer.camera[vars.getWorldPosition]();
		let espVal = this.settings.renderESP.val;
		
		for (let iter = 0, length = this.game.players.list.length; iter < length; iter++) {
			let player = this.game.players.list[iter];
			if (!player || player[vars.isYou] || !player.active || !utils.isDefined(player[vars.objInstances]) ) {
				continue;
			}

			let isEnemy = !this.me.team || this.me.team != player.team;
			let isRisky = player.isDev || player.isMod || player.isMapMod || player.canGlobalKick || player.canViewReports || player.partnerApp || player.canVerify || player.canTeleport || player.kpdData || player.fakeName || player.level >= 100;

			// Chams
			if (!player[vars.objInstances].visible) {
				Object.defineProperty(player[vars.objInstances], 'visible', {
					value: true,
					writable: false
				});
			} else {
				player[vars.objInstances].traverse(obj => {
					if (obj && obj.type=='Mesh' && obj.hasOwnProperty('material')) {
						if (!obj.hasOwnProperty('_material')) {
							obj._material = obj.material;
						} else {
							Object.defineProperty(obj, 'material', {
								get() {
									if (utils.isDefined(main.mesh) && main.settings.renderChams.val) {
										return main.mesh[ isEnemy ? isRisky ? "#FFFF00" : main.settings.rainbowColor.val ? main.overlay.rainbow.col : main.settings.chamHostileCol.val||"#ff0000" : main.settings.chamFriendlyCol.val||"#00ff00"];
									}
									return this._material;
								}, set(val) {return this._material}
							});
						}

						obj.material.wireframe = !!main.settings.renderWireFrame.val;
					}
				})
			}

			//ESP
			// the below variables correspond to the 2d box esps corners
			let xmin = Infinity;
			let xmax = -Infinity;
			let ymin = Infinity;
			let ymax = -Infinity;
			let position = null;
			let br = false;
			for (let j = -1; !br && j < 2; j+=2) {
				for (let k = -1; !br && k < 2; k+=2) {
					for (let l = 0; !br && l < 2; l++) {
						if (position = player[vars.objInstances].position.clone()) {
							position.x += j * playerScale;
							position.z += k * playerScale;
							position.y += l * (player.height - player[vars.crouchVal] * vars.consts.crouchDst);
							if (!this.containsPoint(position)) {
								br = true;
								break;
							}
							position.project(this.renderer.camera);
							xmin = Math.min(xmin, position.x);
							xmax = Math.max(xmax, position.x);
							ymin = Math.min(ymin, position.y);
							ymax = Math.max(ymax, position.y);
						}
					}
				}
			}

			if (br) {
				continue;
			}

			xmin = (xmin + 1) / 2;
			ymin = (ymin + 1) / 2;
			xmax = (xmax + 1) / 2;
			ymax = (ymax + 1) / 2;

			// save and restore these variables later so they got nothing on us
			const original_strokeStyle = this.ctx.strokeStyle;
			const original_lineWidth = this.ctx.lineWidth;
			const original_font = this.ctx.font;
			const original_fillStyle = this.ctx.fillStyle;

			//Tracers
			if (this.settings.renderTracers.val) {
				CRC2d.save.apply(this.ctx, []);
				let screenPos = this.world2Screen(player[vars.objInstances].position);
				this.ctx.lineWidth = 1;
				this.ctx.beginPath();
				this.ctx.moveTo(this.ctx.canvas.width/2, this.ctx.canvas.height - (this.ctx.canvas.height - scaledHeight));
				this.ctx.lineTo(screenPos.x, screenPos.y);
				this.ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
				this.ctx.stroke();
				this.ctx.lineWidth = 1;
				this.ctx.strokeStyle = isEnemy ? isRisky ? "#FFFF00" : main.settings.espHostileCol.val||"#ff0000" : main.settings.espFriendlyCol.val||"#00ff00"//this.settings.rainbowColor.val ? this.overlay.rainbow.col : "#eb5656"
				this.ctx.stroke();
				CRC2d.restore.apply(this.ctx, []);
			}

			CRC2d.save.apply(this.ctx, []);
			if (espVal == "twoD" || espVal == "full") {
				// perfect box esp
				this.ctx.lineWidth = 5;
				this.ctx.strokeStyle = isEnemy ? isRisky ? "#FFFF00" : main.settings.espHostileCol.val||"#ff0000" : main.settings.espFriendlyCol.val||"#00ff00"//this.settings.rainbowColor.val ? this.overlay.rainbow.col : "#eb5656"
				let distanceScale = Math.max(.3, 1 - this.getD3D(worldPosition.x, worldPosition.y, worldPosition.z, player.x, player.y, player.z) / 600);
				CRC2d.scale.apply(this.ctx, [distanceScale, distanceScale]);
				let xScale = scaledWidth / distanceScale;
				let yScale = scaledHeight / distanceScale;
				CRC2d.beginPath.apply(this.ctx, []);
				ymin = yScale * (1 - ymin);
				ymax = yScale * (1 - ymax);
				xmin = xScale * xmin;
				xmax = xScale * xmax;
				CRC2d.moveTo.apply(this.ctx, [xmin, ymin]);
				CRC2d.lineTo.apply(this.ctx, [xmin, ymax]);
				CRC2d.lineTo.apply(this.ctx, [xmax, ymax]);
				CRC2d.lineTo.apply(this.ctx, [xmax, ymin]);
				CRC2d.lineTo.apply(this.ctx, [xmin, ymin]);
				CRC2d.stroke.apply(this.ctx, []);

				if (espVal == "full") {
					// health bar
					this.ctx.fillStyle = "#000000";
					let barMaxHeight = ymax - ymin;
					CRC2d.fillRect.apply(this.ctx, [xmin - 7, ymin, -10, barMaxHeight]);
					this.ctx.fillStyle = player.health > 75 ? "green" : player.health > 40 ? "orange" : "red";
					CRC2d.fillRect.apply(this.ctx, [xmin - 7, ymin, -10, barMaxHeight * (player.health / player[vars.maxHealth])]);
					// info
					this.ctx.font = "Bold 48px Tahoma";
					this.ctx.fillStyle = "white";
					this.ctx.strokeStyle='black';
					this.ctx.lineWidth = 1;
					let x = xmax + 7;
					let y = ymax;
					CRC2d.fillText.apply(this.ctx, [player.name||player.alias, x, y]);
					CRC2d.strokeText.apply(this.ctx, [player.name||player.alias, x, y]);
					this.ctx.font = "Bold 30px Tahoma";
					this.ctx.fillStyle = "#cccccc";
					y += 35;
					CRC2d.fillText.apply(this.ctx, [player.weapon.name, x, y]);
					CRC2d.strokeText.apply(this.ctx, [player.weapon.name, x, y]);
					y += 35;
					this.ctx.fillStyle = player.health > 75 ? "green" : player.health > 40 ? "orange" : "red";
					CRC2d.fillText.apply(this.ctx, [player.health + ' HP', x, y]);
					CRC2d.strokeText.apply(this.ctx, [player.health + ' HP', x, y]);
				}
			}

			CRC2d.restore.apply(this.ctx, []);
			this.ctx.strokeStyle = original_strokeStyle;
			this.ctx.lineWidth = original_lineWidth;
			this.ctx.font = original_font;
			this.ctx.fillStyle = original_fillStyle;
		}

		if (this.settings.fovBoxSize.val !== 'off') {
			let fovBox = null;
			switch (this.settings.fovBoxSize.val) {
				case 'large':
					fovBox = [scaledWidth / 3, scaledHeight / 4, scaledWidth * (1 / 3), scaledHeight / 2]
					break;
					// medium
				case 'medium':
					fovBox = [scaledWidth * 0.4, scaledHeight / 3, scaledWidth * 0.2, scaledHeight / 3]
					break
					// small
				case 'small':
					fovBox = [scaledWidth * 0.45, scaledHeight * 0.4, scaledWidth * 0.1, scaledHeight * 0.2]
					break
			}
			CRC2d.save.apply(this.ctx, []);
			this.ctx.strokeStyle = "red"
			this.ctx.strokeRect(...fovBox)
			CRC2d.restore.apply(this.ctx, []);
		}
	}

	createSettings() {

		this.settings = {

			// Render

			renderESP: {
				tab: "Render",
				name: "Player ESP Type",
				val: "off",
				html: () =>
				this.generateSetting("select", "renderESP", {
					off: "Off",
					walls: "Walls",
					twoD: "2d",
					full: "Full"
				}),
				set: (value) => {
					this.nameTags=(value=="off")?undefined:true;
					this.noNameTags=(value=="full")?true:undefined;
				}
			},
			renderTracers: {
				tab: "Render",
				name: "Player Tracers",
				val: false,
				html: () => this.generateSetting("checkbox", "renderTracers"),
			},
			espHostileCol: {
				tab: "Render",
				name: "Hostile Color",
				val: "#ff0000",
				html: () => this.generateSetting("color", "espHostileCol"),
			},
			espFriendlyCol: {
				tab: "Render",
				name: "Friendly Color",
				val: "#00ff00",
				html: () => this.generateSetting("color", "espFriendlyCol"),
			},
			renderChams: {
				tab: "Render",
				pre: "<div class='separator'>Color Chams</div>",
				name: "Player Chams",
				val: false,
				html: () => this.generateSetting("checkbox", "renderChams") //+
			},
			renderWireFrame: {
				tab: "Render",
				name: "Player Wireframe",
				val: false,
				html: () => this.generateSetting("checkbox", "renderWireFrame"),
			},
			rainbowColor: {
				tab: "Render",
				name: "Rainbow Color",
				val: false,
				html: () => this.generateSetting("checkbox", "rainbowColor"),
			},
			chamHostileCol: {
				tab: "Render",
				name: "Hostile Color",
				val: "#ff0000",
				html: () => this.generateSetting("color", "chamHostileCol"),
			},
			chamFriendlyCol: {
				tab: "Render",
				name: "Friendly Color",
				val: "#00ff00",
				html: () => this.generateSetting("color", "chamFriendlyCol"),
			},
			hideAdverts: {
				tab: "Render",
				pre: "<div class='separator'>Krunker UI</div>",
				name: "Hide Advertisments",
				val: true,
				html: () => this.generateSetting("checkbox", "hideAdverts"),
				set: (value, init) => {
					if (value) this.mainCustomRule("insert", this.css.hideAdverts);
					else if (!init) this.mainCustomRule("delete", this.css.hideAdverts);
				}
			},
			hideStreams: {
				tab: "Render",
				name: "Hide Streams",
				val: false,
				html: () => this.generateSetting("checkbox", "hideStreams"),
				set: (value) => { this.displayStyle("streamContainer", value) }
			},
			hideMerch: {
				tab: "Render",
				name: "Hide Merch",
				val: false,
				html: () => this.generateSetting("checkbox", "hideMerch"),
				set: (value) => { this.displayStyle("merchHolder", value) }
			},
			hideNewsConsole: {
				tab: "Render",
				name: "Hide News Console",
				val: false,
				html: () => this.generateSetting("checkbox", "hideNewsConsole"),
				set: (value) => { this.displayStyle("newsHolder", value) }
			},
			hideCookieButton: {
				tab: "Render",
				name: "Hide Security Manage Button",
				val: false,
				html: () => this.generateSetting("checkbox", "hideCookieButton"),
				set: (value) => { this.displayStyle("onetrust-consent-sdk", value) }
			},
			//Rendering
			showSkidBtn: {
				tab: "Render",
				pre: "<hr>",
				name: "Show Menu Button",
				val: true,
				html: () => this.generateSetting("checkbox", "showSkidBtn"),
				set: (value, init) => {
					let button = document.getElementById("mainButton");
					if (!utils.isDefined(button)) utils.createButton("Junk", "https://i.imgur.com/pA5e8hy.png", this.toggleMenu, value)
					utils.waitFor(() => document.getElementById("mainButton")).then(button => { button.style.display = value ? "inherit" : "none" })
				}
			},
			customCSS: {
				tab: "Render",
				pre: "<hr>",
				name: "Custom CSS",
				val: "",
				html: () => this.generateSetting("url", "customCSS", "URL to CSS file"),
				css: document.createElement("link"),
				set: (value, init) => {
					if (value && value.startsWith("http")&&value.endsWith(".css")) {
						this.settings.customCSS.css.href = value
					} else this.settings.customCSS.css.href = null
					if (init && this.settings.customCSS.css) {
						this.settings.customCSS.css.rel = "stylesheet"
						try {
							document.getElementsByTagName('head')[0].appendChild(this.settings.customCSS.css)
						} catch(e) {
							console.error(e)
							this.settings.customCSS.css = null
						}
					}
				}
			},
			customBillboard: {
				tab: "Render",
				name: "Custom Billboard Text",
				val: "",
				html: () =>
				this.generateSetting(
					"text",
					"customBillboard",
					"Custom Billboard Text"
				),
			},

			// Weapon

			autoReload: {
				tab: "Weapon",
				//pre: "<br><div class='setHed'>Weapon</div>",
				name: "Auto Reload",
				val: false,
				html: () => this.generateSetting("checkbox", "autoReload"),
			},
			weaponZoom: {
				tab: "Weapon",
				name: "Weapon Zoom",
				val: 1.0,
				min: 0,
				max: 50.0,
				step: 0.01,
				html: () => this.generateSetting("slider", "weaponZoom"),
				set: (value) => utils.waitFor(() => this.renderer).then(renderer => renderer.adsFovMlt.fill(value))
			},
			weaponTrails: {
				tab: "Weapon",
				name: "Weapon Trails",
				val: false,
				html: () => this.generateSetting("checkbox", "weaponTrails"),
				set: (value) => utils.waitFor(() => this.me).then(me => { me.weapon.trail = value })
			},
			autoAim: {
				tab: "Weapon",
				pre: "<div class='separator'>Auto Aim</div>",
				name: "Auto Aim Type",
				val: "off",
				html: () =>
				this.generateSetting("select", "autoAim", {
					off: "Off",
					correction: "Aim Correction",
					assist: "Legit Aim Assist",
					easyassist: "Easy Aim Assist",
					silent: "Silent Aim",
					trigger: "Trigger Bot",
					quickScope: "Quick Scope"
				}),
			},

			fovBoxSize: {
				tab: "Weapon",
				name: "FOV Box Type",
				val: "off",
				html: () =>
				this.generateSetting("select", "fovBoxSize", {
					off: "Off",
					small: "Small",
					medium: "Medium",
					large: "Large"
				})
			},


			aimOffset: {
				tab: "Weapon",
				name: "Aim Offset",
				val: 0,
				min: -4,
				max: 1,
				step: 0.01,
				html: () => this.generateSetting("slider", "aimOffset"),
				set: (value) => { if (this.settings.playStream.audio) this.settings.playStream.audio.volume = value;}
			},
			frustrumCheck: {
				tab: "Weapon",
				name: "Player Visible Check",
				val: false,
				html: () => this.generateSetting("checkbox", "frustrumCheck"),
			},
			wallPenetrate: {
				tab: "Weapon",
				name: "Aim through Penetratables",
				val: false,
				html: () => this.generateSetting("checkbox", "wallPenetrate"),
			},

			// Player

			autoBhop: {
				tab: "Player",
				//pre: "<br><div class='setHed'>Player</div>",

				name: "Auto Bhop Type",
				val: "off",
				html: () => this.generateSetting("select", "autoBhop", {
					off: "Off",
					autoJump: "Auto Jump",
					keyJump: "Key Jump",
					autoSlide: "Auto Slide",
					keySlide: "Key Slide"
				}),
			},
			skinUnlock: {
				tab: "Player",
				name: "Unlock Skins",
				val: false,
				html: () => this.generateSetting("checkbox", "skinUnlock"),
			},

			// GamePlay

			autoActivateNuke: {
				tab: "GamePlay",
				name: "Auto Activate Nuke",
				val: false,
				html: () => this.generateSetting("checkbox", "autoActivateNuke"),
			},
			autoFindNew: {
				tab: "GamePlay",
				name: "New Lobby Finder",
				val: false,
				html: () => this.generateSetting("checkbox", "autoFindNew"),
			},
			autoClick: {
				tab: "GamePlay",
				name: "Auto Start Game",
				val: false,
				html: () => this.generateSetting("checkbox", "autoClick"),
			},
			noInActivity: {
				tab: "GamePlay",
				name: "No InActivity Kick",
				val: true,
				html: () => this.generateSetting("checkbox", "noInActivity"),
			},

			// Radio

			playStream: {
				tab: "Radio",
				//pre: "<br><div class='setHed'>Radio Stream Player</div>",
				name: "Stream Select",
				val: "off",
				html: () => this.generateSetting("select", "playStream", {
					off: 'Off',
					_2000s: 'General German/English',
					_HipHopRNB: 'Hip Hop / RNB',
					_Oldskool: 'Hip Hop Oldskool',
					_Country: 'Country',
					_Pop: 'Pop',
					_Dance: 'Dance',
					_Dubstep: 'DubStep',
					_Lowfi: 'LoFi HipHop',
					_Jazz: 'Jazz',
					_Oldies: 'Golden Oldies',
					_Club: 'Club',
					_Folk: 'Folk',
					_ClassicRock: 'Classic Rock',
					_Metal: 'Heavy Metal',
					_DeathMetal: 'Death Metal',
					_Classical: 'Classical',
					_Alternative: 'Alternative',
				}),
				set: (value) => {
					if (value == "off") {
						if ( this.settings.playStream.audio ) {
							this.settings.playStream.audio.pause();
							this.settings.playStream.audio.currentTime = 0;
							this.settings.playStream.audio = null;
						}
						return;
					}
					let url = this.settings.playStream.urls[value];
					if (!this.settings.playStream.audio) {
						this.settings.playStream.audio = new Audio(url);
						this.settings.playStream.audio.volume = this.settings.audioVolume.val||0.5
					} else {
						this.settings.playStream.audio.src = url;
					}
					this.settings.playStream.audio.load();
					this.settings.playStream.audio.play();
				},
				urls: {
					_2000s: 'http://0n-2000s.radionetz.de/0n-2000s.aac',
					_HipHopRNB: 'https://stream-mixtape-geo.ntslive.net/mixtape2',
					_Country: 'https://live.wostreaming.net/direct/wboc-waaifmmp3-ibc2',
					_Dance: 'http://streaming.radionomy.com/A-RADIO-TOP-40',
					_Pop: 'http://bigrradio.cdnstream1.com/5106_128',
					_Jazz: 'http://strm112.1.fm/ajazz_mobile_mp3',
					_Oldies: 'http://strm112.1.fm/60s_70s_mobile_mp3',
					_Club: 'http://strm112.1.fm/club_mobile_mp3',
					_Folk: 'https://freshgrass.streamguys1.com/irish-128mp3',
					_ClassicRock: 'http://1a-classicrock.radionetz.de/1a-classicrock.mp3',
					_Metal: 'http://streams.radiobob.de/metalcore/mp3-192',
					_DeathMetal: 'http://stream.laut.fm/beatdownx',
					_Classical: 'http://live-radio01.mediahubaustralia.com/FM2W/aac/',
					_Alternative: 'http://bigrradio.cdnstream1.com/5187_128',
					_Dubstep: 'http://streaming.radionomy.com/R1Dubstep?lang=en',
					_Lowfi: 'http://streams.fluxfm.de/Chillhop/mp3-256',
					_Oldskool: 'http://streams.90s90s.de/hiphop/mp3-128/',
				},
				audio: null,
			},

			audioVolume: {
				tab: "Radio",
				name: "Radio Volume",
				val: 0.5,
				min: 0,
				max: 1,
				step: 0.01,
				html: () => this.generateSetting("slider", "audioVolume"),
				set: (value) => { if (this.settings.playStream.audio) this.settings.playStream.audio.volume = value;}
			},

			// Dev

		   saveGameJsBtn: {
				tab: "Dev",
				name: "Save Game Script",
				val: false,
				html: () => this.generateSetting("button", "saveGameJsBtn", { label:"Save", function: `${vars.key}.saveGame()`}),
			},
		}

		async function getSavedSettings() {

			async function getValue(key) {
				let value = await GM.getValue(key, "Fuck");
				if (value != "Fuck" && value != undefined) {
					return value;
				} else {
					return new Promise((resolve) => {
						window.setTimeout(() => resolve(getValue()), 10);
					})
				}
			}

			for (let key in main.settings) {
				const value = await getValue(key);
				main.settings[key].val = value !== null ? value : main.settings[key].val;
				main.settings[key].def = main.settings[key].val;
				if (main.settings[key].val == "false") main.settings[key].val = false;
				if (main.settings[key].val == "true") main.settings[key].val = true;
				if (main.settings[key].val == "undefined") main.settings[key].val = main.settings[key].def;
				if (main.settings[key].set) main.settings[key].set(main.settings[key].val, true);
			}

		}

		utils.waitFor(() => window.windows).then(() => {
			let win = window.windows[11]; win.html = "";
			win.header = utils.genHash(8);
			win.gen = ()=> {
				let tmpHTML = `<div class='wrapper'><div class="content"><div class="guild-icon" style="background-image: url(&quot;https://cdn.discordapp.com/icons/${this.discord.guild.id}/${this.discord.guild.icon}.webp?size=64&quot;);"></div><div class="guild-info" style="flex: 1 1 auto;"><div class="guild-name"> <a href="https://e9x.github.io/kru/inv">${this.discord.guild.name}</a> &nbsp;&nbsp;&nbsp;<div class="colorStandard size14 guildDetail"><div class="statusCounts"><i class="statusOnline status"></i><span class="count-30T-5k online-count">${this.discord.approximate_presence_count} Online</span>&nbsp;<i class="statusOffline status"></i><span class="count-30T-5k offline-count">${this.discord.approximate_member_count} Members</span></div></div></div></div><button type="button" class="d-button join-button" onmouseenter="playTick()" onclick="window.location.href='https://discord.com/invite/${this.discord.code}'"><div class="d-button-label">Join</div></button></div></div>`;
				tmpHTML += '<div class="tab">'; this.tabs.forEach(tab => { tmpHTML += `<button class="tablinks" onclick="${vars.key}.tabChange(event, '${tab}')">${tab}</button>` }); tmpHTML +='</div>'
				this.tabs.forEach(tab => {
					tmpHTML += `<div id="${tab}" class="tabcontent"> ${this.tabContent(tab)} </div>`
				})

				return tmpHTML
			}
			for (const key in this.settings) {
				this.settings[key].def = this.settings[key].val;
				if (!this.settings[key].disabled) {
					let tmpVal = this.getSavedVal(key);
					this.settings[key].val = tmpVal !== null ? tmpVal : this.settings[key].val;
					this.settings[key].val = this.settings[key].val;
					if (this.settings[key].val == "false") this.settings[key].val = false;
					if (this.settings[key].val == "true") this.settings[key].val = true;
					if (this.settings[key].val == "undefined") this.settings[key].val = this.settings[key].def;
					if (this.settings[key].set) this.settings[key].set(this.settings[key].val, true);
				}
			}
			//return getSavedSettings();
		})
	}

	toggleMenu() {
		let lock = document.pointerLockElement || document.mozPointerLockElement;
		if (lock) document.exitPointerLock();
		window.showWindow(12);
		if (utils.isDefined(window.SOUND)) window.SOUND.play(`tick_0`,0.1)
	}

	tabChange(evt, tabName) {
		var i, tabcontent, tablinks;
		tabcontent = document.getElementsByClassName("tabcontent");
		for (i = 0; i < tabcontent.length; i++) {
			tabcontent[i].style.display = "none";
		}
		tablinks = document.getElementsByClassName("tablinks");
		for (i = 0; i < tablinks.length; i++) {
			tablinks[i].className = tablinks[i].className.replace(" active", "");
		}
		document.getElementById(tabName).style.display = "block";
		evt.currentTarget.className += " active";
	}

	tabContent(name) {
		let tmpHTML = "";
		for (let key in this.settings) {
			if (this.settings[key].tab == name) {
				if (this.settings[key].pre) tmpHTML += this.settings[key].pre;
				tmpHTML += "<div class='settName' id='" + key + "_div' style='display:block'>" + this.settings[key].name + " " + this.settings[key].html() + "</div>";
			}
		}
		return tmpHTML;
	}

	saveGame(){
		var link = utils.add_ele('a', document.documentElement, { href: api.resolve({
			target: api.api_v2,
			endpoint: 'source',
			query: { download: true },
		}) });

		link.click();

		link.remove();
	}

	generateSetting(type, name, extra) {
		switch (type) {
			case 'button':
				return `<input type="button" name="${type}" id="slid_utilities_${name}" class="settingsBtn" onclick="${extra.function}" value="${extra.label}" style="float:right;width:auto"/>`;
			case 'checkbox':
				return `<label class="switch"><input type="checkbox" onclick="${vars.key}.setSetting('${name}', this.checked)" ${this.settings[name].val ? 'checked' : ''}><span class="slider"></span></label>`;
			case 'slider':
				return `<span class='sliderVal' id='slid_utilities_${name}'>${this.settings[name].val}</span><div class='slidecontainer'><input type='range' min='${this.settings[name].min}' max='${this.settings[name].max}' step='${this.settings[name].step}' value='${this.settings[name].val}' class='sliderM' oninput="${vars.key}.setSetting('${name}', this.value)"></div>`
				case 'select': {
					let temp = `<select onchange="${vars.key}.setSetting(\x27${name}\x27, this.value)" class="inputGrey2">`;
					for (let option in extra) {
						temp += '<option value="' + option + '" ' + (option == this.settings[name].val ? 'selected' : '') + '>' + extra[option] + '</option>';
					}
					temp += '</select>';
					return temp;
				}
			default:
				return `<input type="${type}" name="${type}" id="slid_utilities_${name}"\n${'color' == type ? 'style="float:right;margin-top:5px"' : `class="inputGrey2" placeholder="${extra}"`}\nvalue="${this.settings[name].val}" oninput="${vars.key}.setSetting(\x27${name}\x27, this.value)"/>`;
		}
	}

	setSetting(key, value) {
		this.settings[key].val = value;
		//await GM.setValue(key, value);
		this.saveVal(key, value);
		if (document.getElementById(`slid_utilities_${key}`)) document.getElementById(`slid_utilities_${key}`).innerHTML = value;
		if (this.settings[key].set) this.settings[key].set(value);
	}

	saveVal(name, val) {
		localStorage.setItem("krk_"+name, val);
	}

	deleteVal(name) {
		localStorage.removeItem("krk_"+name);
	}

	getSavedVal(name) {
		return localStorage.getItem("krk_"+name);
	}

	async gameHooks() {
		let main = this;
		
		let exports = await utils.waitFor(() => this.exports);
		
		let toFind = {
			overlay: ["render", "canvas"],
			config: ["accAnnounce", "availableRegions", "assetCat"],
			three: ["ACESFilmicToneMapping", "TextureLoader", "ObjectLoader"],
		};
		
		for (let rootKey in exports) {
			let exp = exports[rootKey].exports;
			for (let name in toFind) {
				if (utils.objectHas(exp, toFind[name])) {
					console.info("Found Export ", name);
					delete toFind[name];
					this[name] = exp;
				}
			}
		}
		
		if (!(Object.keys(toFind).length === 0 && toFind.constructor === Object)) {
			for (let name in toFind) {
				alert("Failed To Find Export " + name);
			}
		} else {
			Object.defineProperties(this.config, {
				nameVisRate: {
					value: 0,
					writable: false
				},
				//serverBrowserRate: {
				//    value: 0,
				//    writable: false
				//},
				serverTickFrequency: {
					value: 60,
					writable: false
				},
				syncRate: {
					value: 0,
					writable: false
				},
				hitBoxPad: {
					value: 0,
					writable: false
				},
			});

			this.ray = new this.three.Raycaster();
			this.vec2 = new this.three.Vector2(0, 0);
			this.mesh = new Proxy({}, {
				get(target, prop){
					if(!target[prop]) {
						target[prop] = new main.three.MeshBasicMaterial({
							transparent: true,
							fog: false,
							depthTest: false,
							color: prop,
						});
					}
					return target[prop] ;
				},
			});

			this.ctx = this.overlay.canvas.getContext('2d');
			this.overlay.render = new Proxy(this.overlay.render, {
				apply: (target, that, args) => {
					return [target.apply(that, args), this.overlayRender(args, ...args)]
				}
			});
		}


		const $origSkins = Symbol("origSkins"), $localSkins = Symbol("localSkins");
		Object.defineProperties(Object.prototype, {
			skins: {
				set(fn) {
					//console.log(this.toString())
					//console.log(this)
					this[$origSkins] = fn;
					if (void 0 == this[$localSkins] || !this[$localSkins].length) {
						this[$localSkins] = Array.apply(null, Array(5e3)).map((x, i) => {
							return {
								ind: i,
								cnt: 0x1,
							}
						})
					}
					return fn;
				},
				get() {
					return main.settings.skinUnlock.val && this.stats ? this[$localSkins] : this[$origSkins];
				}
			},
		})
		
		utils.waitFor(() => this.ws).then(() => {
			this.wsEvent = this.ws._dispatchEvent.bind(this.ws);
			this.wsSend = this.ws.send.bind(this.ws);
			this.ws.send = new Proxy(this.ws.send, {
				apply: function(target, that, [type, ...msg]) {
					if (type=="ah2") return;
					if (type=="en") {
						let data = msg[0];
						if (data) {
							main.skinData = Object.assign({}, {
								main: data[2][0],
								secondary: data[2][1],
								hat: data[3],
								body: data[4],
								knife: data[9],
								dye: data[14],
								waist: data[17],
							});
						}
					}

					return target.apply(that, [type, ...msg]);
				}
			})

			this.ws._dispatchEvent = new Proxy(this.ws._dispatchEvent, {
				apply: function(target, that, [type, ...msg]) {
					if (type =="init") {
						let pInfo = msg[0];
						if(pInfo[10] && pInfo[10].bill && main.settings && main.settings.customBillboard.val.length > 1) {
							pInfo[10].bill.txt = main.settings.customBillboard.val;
						}
					}

					if (type=="0") {
						let pData = msg[0][0];
						let pSize = 39;
						while (pData.length % pSize !== 0) pSize++;
						for(let i = 0; i < pData.length; i += pSize) {
							if (pData[i] === main.ws.socketId||0) {
								pData[i + 12] = [main.skinData.main, main.skinData.secondary];
								pData[i + 13] = main.skinData.hat;
								pData[i + 14] = main.skinData.body;
								pData[i + 19] = main.skinData.knife;
								pData[i + 24] = main.skinData.dye;
								pData[i + 33] = main.skinData.waist;
							}
						}
					}
					if (type=="3") {
						if (msg[0][4]) {
							msg[0][4].wId=0;
							msg[0][4].hs=true;
							 msg[0][4].dst=Infinity
							msg[0][4].wb=true;
						}

					}
					
					return target.apply(that, [type, ...msg]);
				}
			})
		})
	}
	
	overlayRender(renderArgs, scale, game, controls, renderer, me){
		let width = this.overlay.canvas.width / scale;
		let height = this.overlay.canvas.height / scale;
		
		if (controls && typeof this.settings == "object" && this.settings.noInActivity.val) {
			controls.idleTimer = 0;
			if (utils.isDefined(this.config)) this.config.kickTimer = Infinity;
		}
		if (me) {
			if (me.active && me.health) controls.update();
			if (me.banned) Object.assign(me, {banned: false});
			if (me.isHacker) Object.assign(me, {isHacker: 0});
			if (me.kicked) Object.assign(me, {kicked: false});
			if (me.kickedByVote) Object.assign(me, {kickedByVote: false});
			me.account = Object.assign(me, {premiumT: true});
			
			["scale", "game", "controls", "renderer", "me"].forEach((item, index)=>{
				this[item] = renderArgs[index];
			});
			this.ctx.save();
			this.ctx.scale(scale, scale);
			// this.ctx.clearRect(0, 0, width, height);
			this.onRender();
			this.ctx.restore();
		}
		
		if (utils.isType(this.settings, 'object')) {
			if (this.settings.hasOwnProperty('autoActivateNuke') && this.settings.autoActivateNuke.val) {
				if (this.me && Object.keys(this.me.streaks).length) this.wsSend("k", 0);
			}
			if (this.settings.hasOwnProperty('autoClick') && this.settings.autoClick.val) {
				if (window.endUI.style.display == "none" && window.windowHolder.style.display == "none") controls.toggle(true);
			}
		}
	}
	
	gameLoad(source, tokenPromise){
		new Function("WP_fetchMMToken", vars.key, vars.patch(source))(tokenPromise, this);
	}
	
	mainCustomRule(action, rule) {
		utils.waitFor(() => this.mainCustom).then(() => {
			const rules = this.mainCustom.cssRules;
			if (action == "insert") this.mainCustom.insertRule(rule);
			else if (action == "delete") {
				for (let i = 0; i < rules.length; i++) {
					if (rules[i].cssText == rule) {
						this.mainCustom.deleteRule(i);
					}
				}
			} else console.error(action + " not Implemented for mainCustomRule")
		})
	}
	
	displayStyle(el, val) {
		utils.waitFor(() => window[el], 5e3).then(node => {
			if (node) node.style.display = val ? "none" : "inherit";
			else log.error(el, " was not found in the window object");
		})
	}

	stylesheets() {
		// Get Main Custom CSS
		new Array(...document.styleSheets).map(css => {
			if (css.href) {
				let arr = /http.*?krunker.io\/css\/(\w+.css).+/.exec(css.href);
				if (arr && arr[1]) {
					let name = arr[1];
					if (name && name.includes("main_custom")) {
						this.mainCustom = css;
					}
				}
			}
		})
		let css = {
			tabStyle: '.tab { overflow: hidden; border: 1px solid #ccc; background-image: linear-gradient(#2f3136, #f1f1f1, #2f3136); }',
			btnStyle: '.tab button { background-color: inherit; float: left; border: none; outline: solid; cursor: pointer; padding: 14px 16px; transition: 0.3s; font-size: 17px; font-weight:500;color:black;text-shadow: 2px 2px #FFF;}',
			btnHoverStyle: '.tab button:hover { background-color: #ddd; }',
			activeTabStyle: '.tab button.active { background-color: #ccc; }',
			tabContentStyle: '.tabcontent { display: none; padding: 6px 12px; border: 1px solid #ccc; border-top: none; animation: fadeEffect 1s; /* Fading effect takes 1 second */}',
			zeroToFullOpacity: '@keyframes fadeEffect { from {opacity: 0;} to {opacity: 1;} }',

			separator: `.separator{display:flex;align-items:center;text-align:center}.separator::before,.separator::after{content:'';flex:1;border-bottom:1px solid #000}.separator:not(:empty)::before{margin-right:.25em}.separator:not(:empty)::after{margin-left:.25em}`,

			discordWrapper: `.wrapper{background:#2f3136;width:100%;}`,
			discordContent: `.content{display:flex;-webkit-box-orient:horizontal;-webkit-box-direction:normal;flex-flow:row nowrap}`,
			discordInfo: `.guild-info{flex:1 1 auto;min-width:1px;-webkit-box-orient:vertical;-webkit-box-direction:normal;flex-direction:column;flex-wrap:nowrap;display:flex;align-items:stretch;-webkit-box-align:stretch;justify-content:center;text-indent:0}`,
			discordIcon: `.guild-icon{background-color:#333;margin-right:16px;flex:0 0 auto;width:50px;height:50px;border-radius:15px;position:relative;background-clip:padding-box;background-position:50%;background-size:100% 100%}`,
			discordDesc: `.inv-desc{font-weight:700;margin:0;margin-bottom:12px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;color:#b9bbbe;text-transform:uppercase;font-size:12px;line-height:12px;flex:1}`,
			discordName: `.guild-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:20px;align-items:center;display:flex;color:#FFF;font-weight:700}`,
			discordNameHover: `.guild-name:hover{cursor:pointer;text-decoration:underline}`,
			discordBtn: `.d-button{align-self:center;margin-left:10px;margin-top:4px;white-space:nowrap;flex:0 0 auto;position:relative;display:flex;justify-content:center;align-items:center;border-radius:3px;border:none;font-size:14px;font-weight:500;line-height:20px;height:43px;padding:2px 20px;user-select:none;transition:background-color .1s ease,color .1s ease;color:#FFF;background:#4B8;cursor:pointer}`,
			discordBtnHover: `.d-button:hover{background:#3A7;}`,
			discordBtnLabel: `.d-button-label{font-weight:500;color:white;text-shadow: 2px 2px #000;}`,
			discordActive: `.d-button:active{background:#396}`,
			discordInvDest: `.inviteDestination{margin:0}`,
			discordDetail: `.guildDetail{margin:0;font-size:14px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;color:#b9bbbe;line-height:16px}`,
			discordStatusCounts: `.statusCounts{display:flex;-webkit-box-align:center;align-items:center;font-weight:600}`,
			discordStatus: `.status{display:block;margin-right:4px;width:8px;height:8px;border-radius:50%;flex:0 0 auto;font-style:italic}`,
			discordStatusOnline: `.statusOnline{background:#43b581}`,
			discordStatusOffline: `.statusOffline{background:#747f8d}`,
			discordCount: `.count-30T-5k{-webkit-box-flex:0;flex:0 1 auto;margin-right:8px;color:#b9bbbe;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}`,
		}, style = document.createElement('style'); style.type = 'text/css'; document.documentElement.appendChild(style);
		Object.entries(css).forEach(([name, rule], index) => {
			style.appendChild(document.createTextNode(rule));
		})

	}
	eventHandlers() {
		window.addEventListener('load', (event) => {
			console.log('page is fully loaded');
			
			this.stylesheets();

			utils.waitFor(() => document.querySelector('#instructionsUpdate'), 5e3).then(target => {
				if(!target)return console.error('Could not get instructions update');
				utils.createObserver(target, 'style', target => {
					if (this.settings.autoFindNew.val) {
						if (['Kicked', 'Banned', 'Disconnected', 'Error', 'Game is full'].some(text => target && target.innerHTML.includes(text))) {
							location = document.location.origin;
						}
					}
				});
			})

			window.addEventListener('keyup', event =>{
				if (this.downKeys.has(event.code)) this.downKeys.delete(event.code)
			});
			window.addEventListener('keydown', event =>{
				if ('INPUT' == document.activeElement.tagName) return;
				switch (event.code) {
					case 'F1':
						event.preventDefault();
						this.toggleMenu();
						break;

					case 'NumpadSubtract':
						document.exitPointerLock();
						console.dir(window)
						console.dir(this)
						break;
					default:
						if (!this.downKeys.has(event.code)) this.downKeys.add(event.code);
						break;
				}
			});
		});
	}
	getD3D(x1, y1, z1, x2, y2, z2) {
		let dx = x1 - x2;
		let dy = y1 - y2;
		let dz = z1 - z2;
		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	getAngleDst(a, b) {
		return Math.atan2(Math.sin(b - a), Math.cos(a - b));
	}

	getXDire(x1, y1, z1, x2, y2, z2) {
		let h = Math.abs(y1 - y2);
		let dst = this.getD3D(x1, y1, z1, x2, y2, z2);
		return (Math.asin(h / dst) * ((y1 > y2)?-1:1));
	}

	getDir(x1, y1, x2, y2) {
		return Math.atan2(y1 - y2, x1 - x2);
	}

	getDistance(x1, y1, x2, y2) {
		return Math.sqrt((x2 -= x1) * x2 + (y2 -= y1) * y2);
	}

	containsPoint(point) {
		let planes = this.renderer.frustum.planes;
		for (let i = 0; i < 6; i ++) {
			if (planes[i].distanceToPoint(point) < 0) {
				return false;
			}
		}
		return true;
	}

	getCanSee(from, toX, toY, toZ, boxSize) {
		if (!from) return 0;
		boxSize = boxSize||0;
		for (let obj, dist = this.getD3D(from.x, from.y, from.z, toX, toY, toZ),
			 xDr = this.getDir(from.z, from.x, toZ, toX),
			 yDr = this.getDir(this.getDistance(from.x, from.z, toX, toZ), toY, 0, from.y),
			 dx = 1 / (dist * Math.sin(xDr - Math.PI) * Math.cos(yDr)), dz = 1 / (dist * Math.cos(xDr - Math.PI) * Math.cos(yDr)),
			 dy = 1 / (dist * Math.sin(yDr)), yOffset = from.y + (from.height || 0) - vars.consts.cameraHeight,
			 aa = 0; aa < this.game.map.manager.objects.length; ++aa) {
			if (!(obj = this.game.map.manager.objects[aa]).noShoot && obj.active && !obj.transparent && (!this.settings.wallPenetrate.val || (!obj.penetrable || !this.me.weapon.pierce))) {
				let tmpDst = this.lineInRect(from.x, from.z, yOffset, dx, dz, dy, obj.x - Math.max(0, obj.width - boxSize), obj.z - Math.max(0, obj.length - boxSize), obj.y - Math.max(0, obj.height - boxSize), obj.x + Math.max(0, obj.width - boxSize), obj.z + Math.max(0, obj.length - boxSize), obj.y + Math.max(0, obj.height - boxSize));
				if (tmpDst && 1 > tmpDst) return tmpDst;
			}
		}

		return null;
	}

	lineInRect(lx1, lz1, ly1, dx, dz, dy, x1, z1, y1, x2, z2, y2) {
		let t1 = (x1 - lx1) * dx;
		let t2 = (x2 - lx1) * dx;
		let t3 = (y1 - ly1) * dy;
		let t4 = (y2 - ly1) * dy;
		let t5 = (z1 - lz1) * dz;
		let t6 = (z2 - lz1) * dz;
		let tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
		let tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));
		if (tmax < 0) return false;
		if (tmin > tmax) return false;
		return tmin;
	}

	lookDir(xDire, yDire) {
		xDire = xDire / 1000
		yDire = yDire / 1000
		this.controls.object.rotation.y = yDire
		this.controls[vars.pchObjc].rotation.x = xDire;
		this.controls[vars.pchObjc].rotation.x = Math.max(-vars.consts.halfPI, Math.min(vars.consts.halfPI, this.controls[vars.pchObjc].rotation.x));
		this.controls.yDr = (this.controls[vars.pchObjc].rotation.x % Math.PI).round(3);
		this.controls.xDr = (this.controls.object.rotation.y % Math.PI).round(3);
		this.renderer.camera.updateProjectionMatrix();
		this.renderer.updateFrustum();
	}

	resetLookAt() {
		this.controls.yDr = this.controls[vars.pchObjc].rotation.x;
		this.controls.xDr = this.controls.object.rotation.y;
		this.renderer.camera.updateProjectionMatrix();
		this.renderer.updateFrustum();
	}

	world2Screen (position) {
		let pos = position.clone();
		let scaledWidth = this.ctx.canvas.width / this.scale;
		let scaledHeight = this.ctx.canvas.height / this.scale;
		pos.project(this.renderer.camera);
		pos.x = (pos.x + 1) / 2;
		pos.y = (-pos.y + 1) / 2;
		pos.x *= scaledWidth;
		pos.y *= scaledHeight;
		return pos;
	}

	getInView(entity) {
		return null == this.getCanSee(this.me, entity.x, entity.y, entity.z);
	}

	getIsFriendly(entity) {
		return (this.me && this.me.team ? this.me.team : this.me.spectating ? 0x1 : 0x0) == entity.team
	}
};

module.exports = new Main();