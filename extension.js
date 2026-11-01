import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gvc from 'gi://Gvc';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import {getMixerControl} from 'resource:///org/gnome/shell/ui/status/volume.js';
import {selection, switchOutput, watchOutputs} from './outputs.js';

export default class Soundlet extends Extension {
    enable() {
        this._control = getMixerControl();
        this._settings = this.getSettings();
        this._panel = new PanelMenu.Button(0, 'Soundlet', true);
        this._panel.accessible_role = Atk.Role.PUSH_BUTTON;
        this._icon = new St.Icon({style_class: 'system-status-icon'});
        this._panel.add_child(this._icon);
        const click = new Clutter.ClickGesture({required_button: 1});
        click.connect('recognize', () => this._switch());
        this._panel.add_action(click);
        const keyboard = new Clutter.KeyController();
        keyboard.connect('key-press', () => {
            const [, key] = keyboard.get_key();
            if (![Clutter.KEY_space, Clutter.KEY_Return, Clutter.KEY_KP_Enter].includes(key))
                return Clutter.EVENT_PROPAGATE;
            this._switch();
            return Clutter.EVENT_STOP;
        });
        this._panel.add_action(keyboard);
        this._changed = this._settings.connect('changed', () => this._refresh());
        this._unwatch = watchOutputs(this._control, () => this._refresh());
        this._refresh();
        Main.panel.addToStatusArea(this.uuid, this._panel, 0, 'right');
    }

    _selection() {
        return this._control.get_state() === Gvc.MixerControlState.READY
            ? selection(this._control, this._settings) : {};
    }

    _refresh() {
        const {role, target} = this._selection();
        this._icon.icon_name = role === 'a' ? 'audio-speakers-symbolic'
            : role === 'b' ? 'audio-headphones-symbolic' : 'audio-card-symbolic';
        this._panel.accessible_name = target
            ? _('Switch to %s').format(target.label)
            : _('Soundlet — select two available outputs in Preferences');
        this._panel.reactive = Boolean(target) && !this._process;
        this._panel.can_focus = this._panel.reactive;
    }

    _switch() {
        const {target} = this._selection();
        if (!target || this._process)
            return;
        try {
            const process = switchOutput(this._control, target);
            if (!process)
                return;
            this._process = process;
            this._refresh();
            process.wait_check_async(null, (child, result) => {
                try {
                    child.wait_check_finish(result);
                } catch (error) {
                    if (this._process === child)
                        console.error('Soundlet: default output change failed', error);
                }
                if (this._process === child) {
                    this._process = null;
                    this._refresh();
                }
            });
        } catch (error) {
            console.error('Soundlet: output change failed', error);
        }
    }

    disable() {
        const process = this._process;
        this._process = null;
        process?.force_exit();
        this._unwatch();
        this._unwatch = null;
        this._settings.disconnect(this._changed);
        this._panel.destroy();
        this._panel = this._icon = this._settings = this._control = null;
    }
}
