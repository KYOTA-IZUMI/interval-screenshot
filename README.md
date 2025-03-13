# WorkLog App

An automated work logging desktop application that periodically captures screenshots and manages them in a Git repository.

![WorkLog App](screenshots/app_screenshot.png)

## Features

- Easy operation from the menu bar
- Customizable screenshot intervals
- Automatic Git management of screenshots
- Easy access to the screenshots folder

## Installation

### Method 1: Download from Releases

1. Download the latest DMG file from the [releases page](https://github.com/KYOTA-IZUMI/worklog-app/releases)
2. Open the downloaded DMG file and drag & drop the application to the Applications folder
3. Launch the application

### Method 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/KYOTA-IZUMI/worklog-app.git
cd worklog-app

# Install dependencies
npm install

# Launch the application
npm start

# Build the application (create DMG file)
npm run build
```

## Usage

### First Launch

On first launch, the application appears as an icon in the menu bar.

![Menu Bar Icon](screenshots/menubar_icon.png)

### Start Recording Screenshots

1. Click the icon in the menu bar to display the menu
2. Click "Start Recording"

![Start Recording](screenshots/start_recording.png)

Once recording starts, screenshots will be automatically taken at the set interval.

### Setting the Interval

1. Click the icon in the menu bar to display the menu
2. Click "Set Interval"
3. Enter the interval in seconds (minimum 10 seconds) in the dialog that appears
4. Click the "Save" button

![Interval Settings](screenshots/interval_settings.png)

### Opening the Screenshots Folder

1. Click the icon in the menu bar to display the menu
2. Click "Open Folder"

Screenshots are saved in the `~/Documents/WorkLog/screenshots` folder and managed as a Git repository.

![Screenshots Folder](screenshots/screenshots_folder.png)

### Stop Recording

1. Click the icon in the menu bar to display the menu
2. Click "Stop Recording"

## Development

```bash
# Run in development mode
npm start

# Build the application
npm run build
```

## License

MIT 