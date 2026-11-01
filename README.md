# Soundlet

Soundlet 0.1.0 adds a one-click audio output switch to the right side of the GNOME top bar. It targets GNOME Shell 51 with PipeWire, its PulseAudio compatibility service and WirePlumber. The runtime needs Gvc (bundled with GNOME Shell) and the PipeWire tool `pw-metadata` in the session PATH.

## Install Soundlet 0.1.0

Download the extension ZIP from the [0.1.0 pre-release](https://github.com/hogbergmarkus/soundlet/releases/tag/v0.1.0). Open a terminal in the download directory and run the command below.

```sh
gnome-extensions install soundlet@hogbergmarkus.github.io.shell-extension.zip
```

Log out and back in manually on Wayland if GNOME has not discovered the new extension. Then run:

```sh
gnome-extensions enable soundlet@hogbergmarkus.github.io
gnome-extensions prefs soundlet@hogbergmarkus.github.io
```

## Choose the two outputs

Open Soundlet's preferences in the Extensions app. Choose your speaker port for **Output A** and your headphone port for **Output B**. The choices start empty. Each selection is saved immediately, including its port. A disconnected output stays saved.

The panel icon shows speakers for A, headphones for B and a sound card for another or unknown output. Click to switch to the other output. From a third output, the first click selects A. Both selections must be distinct and available. You can also focus the button and press Space or Enter.

WirePlumber routes streams that follow the system default. Applications with a dedicated output, exclusive access or their own device policy can require a change in the application. Each device keeps its own audio level, so the perceived volume may differ after switching.

English and Swedish are included. See [DEVELOPMENT.md](DEVELOPMENT.md) for the hardware test procedure, build requirements and diagnostic commands.

MIT license.
