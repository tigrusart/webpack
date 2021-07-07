'use strict';

var UI = require('../libs/FloatUI'),
	Visual = require('../libs/Visual'),
	Input = require('../libs/Input'),
	Socket = require('../libs/Socket'),
	Player = require('../libs/Player'),
	{ utils, proxy_addons, supported_store, addon_url, meta, store, loader } = require('../libs/consts');

class Main {
	constructor(){
		this.hooked = Symbol();
		this.skins = [...Array(5000)].map((e, i) => ({ ind: i, cnt: 1 }));
		
		this.canvas = utils.add_ele('canvas', UI.frame),
		this.ctx = this.canvas.getContext('2d');
		
		this.resize_canvas();
		window.addEventListener('resize', () => this.resize_canvas());
		
		this.init_interface();
		
		this.visual = new Visual(this.interface);
		this.input = new Input(this.interface);
		
		this.sorts = {
			dist3d: (ent_1, ent_2) => {
				return ent_1.distance_camera - ent_2.distance_camera;
			},
			dist2d: (ent_1, ent_2) => {
				return utils.dist_center(ent_1.rect) - utils.dist_center(ent_2.rect);
			},
			hp: (ent_1, ent_2) => {
				return ent_1.health - ent_2.health;
			},
		};
	}
	resize_canvas(){
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}
	init_interface(){
		var self = this;
		
		this.interface = {
			get ctx(){
				return self.ctx;
			},
			get game(){
				return self.game;
			},
						get force_auto(){
				return self.config.aim.force_auto;
			},
			get controls(){
				return self.controls;
			},
			get player(){
				return self.player;
			},
			get target(){
				return self.target;
			},
			get players(){
				return self.players;
			},
			get esp(){
				return self.config.esp.status;
			},
			get wireframe(){
				return self.config.player.wireframe;
			},
			get walls(){
				return self.config.esp.walls;
			},
			get bhop(){
				return self.config.player.bhop;
			},
			get aim(){
				return self.config.aim.status;
			},
			get aim_offset(){
				return self.config.aim.offset;
			},
			get color(){
				return self.config.color;
			},
			get wallbangs(){
				return self.config.esp.wallbangs;
			},
			get aim_fov(){
				return self.config.aim.fov;
			},
			get aim_smooth(){
				return self.config.aim.smooth;
			},
			get hitchance(){
				return self.config.aim.hitchance;
			},
			get auto_reload(){
				return self.config.aim.auto_reload;
			},
			get unlock_skins(){
				return self.config.player.skins;
			},
			pick_target(){
				self.target = self.players.filter(player => player.can_target).sort((ent_1, ent_2) => self.sorts[ent_1.rect && ent_2.rect ? self.config.aim.target_sorting || 'dist2d' : 'dist3d'](ent_1, ent_2) * (ent_1.frustum ? 1 : 0.5))[0];
			},
		};		
	}
	async load(){
		this.ui = require('./settings');
		
		await this.ui.load_config();
		
		// migrate
		if(typeof this.config.aim.smooth == 'object')this.config.aim.smooth = this.config.aim.smooth.value;
		if(this.config.aim.smooth > 1)this.config.aim.smooth = 0;
		if(typeof this.config.esp.walls == 'object')this.config.esp.walls = 100;
		
		if(this.config.aim.target == 'feet')this.config.aim.target == 'legs';
		else if(this.config.aim.target == 'chest')this.config.aim.target == 'torso';
		
		/*if(this.config.game.custom_loading){
			var loading = new UI.Loading(meta.discord, 'https://y9x.github.io/webpack/libs/gg.gif');
			
			token.then(() => loading.hide()).catch(() => loading.hide());
		}*/
		
		loader.on('instruct', has => {
			if(this.config.game.error_tips){
				if(has('connection banned 0x2'))localStorage.removeItem('krunker_token'), UI.alert([
					`<p>You were IP banned, Sploit has signed you out.\nSpoof your IP to bypass this ban with one of the following:</p>`,
					`<ul>`,
						`<li>Using your mobile hotspot</li>`,
						...proxy_addons.filter(data => data[supported_store]).map(data => `<li><a target='_blank' href=${JSON.stringify(data[supported_store])}>${data.name}</a></li>`),
						`<li>Use a <a target="_blank" href=${JSON.stringify(addon_url('Proxy VPN'))}>Search for a VPN</a></li>`,
					`</ul>`,
				].join(''));
				else if(has('banned - '))UI.alert(
					`<p>You were banned from this match. Find a new game to bypass this.</p>`,
				).then(() => location.assign('/'));
				else if(has('banned'))localStorage.removeItem('krunker_token'), UI.alert(
					`<p>You were banned, Sploit has signed you out.\nCreate a new account to bypass this ban.</p>`,
				).then(() => location.assign('/'));
			}
			
			if(this.config.game.auto_lobby && has('connection error', 'game is full', 'kicked by vote', 'disconnected'))location.href = '/';
			else if(this.config.game.auto_start && has('to play') && (!this.player || !this.player.active)){
				this.controls.locklessChange(true);
				this.controls.locklessChange(false);
			}
		});
		
		this.process = this.process.bind(this);
		this.process();
		
		var $skins = Symbol(),
			self = this;
		
		await loader.load({
			WebSocket: Socket(this.interface),
		}, {
			three: three => utils.three = three,
			game: game => this.game = utils.game = game,
			controls: controls => {
				var timer = 0;
				
				Object.defineProperty(controls, 'idleTimer', {
					get: _ => self.config.game.inactivity ? 0 : timer,
					set: value => timer = value,
				});
				
				this.controls = controls;
			},
			world: world => this.world = utils.world = world,
			can_see: inview => this.config.esp.status == 'full' ? false : (this.config.esp.nametags || inview),
			skins: ent => Object.defineProperty(ent, 'skins', {
				get(){
					return self.config.player.skins ? self.skins : this[$skins];
				},
				set(value){
					return this[$skins] = value;
				},
			}),
			input: this.input,
			timer: (object, property, timer) => Object.defineProperty(object, property, {
				get: _ => this.config.game.inactivity ? 0 : timer,
				set: value => this.config.game.inactivity ? Infinity : timer,
			}),
		});
	}
	process(){
		try{
			this.visual.tick();
			
			if(this.config.game.overlay)this.visual.overlay();
			
			if(this.config.aim.fov_box)this.visual.fov(this.config.aim.fov);
			
			if(this.game && this.world){
				this.visual.walls();
				
				for(let player of this.players){
					if(player.is_you)this.player = player;
					
					if(!player.active)continue;
					
					player.tick();
					
					if(!player.frustum || player.is_you)continue;
					
					this.visual.cham(player);
					
					if(['box', 'box_chams', 'full'].includes(this.config.esp.status))this.visual.box(player);
					
					if(this.config.esp.status == 'full'){
						this.visual.health(player);
						this.visual.text(player);
					}
					
					if(this.config.esp.tracers)this.visual.tracer(player);
				}
			}
		}catch(err){
			loader.report_error('frame', err);
		}
		
		utils.request_frame(this.process);
	}
	get config(){
		return this.ui.config;
	}
	get players(){
		return this.game.players.list.map(ent => this.add(ent));
	}
	add(entity){
		return entity[this.hooked] || (entity[this.hooked] = new Player(this.interface, entity));
	}
};

var main = module.exports = new Main();

main.load();