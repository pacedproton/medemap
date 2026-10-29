# MeDeMAP - Mapping Media for Future Democracies

<img width="1975" height="954" alt="image" src="https://github.com/user-attachments/assets/06e9a567-eaca-4f08-b47d-03e182bc4ae0" />


<br>
<br>
MeDeMAP is an advanced web application that visualizes and analyzes media data across European countries. It provides interactive tools to explore how media environments perform democratic functions under different conditions, offering insights for researchers, policymakers, and citizens.

## Features

### 3D Visualization
- **Interactive 3D globe** powered by Globe.gl and Three.js
- **WebGL-based rendering** for smooth performance
- **3D bar charts** representing data metrics with height scaling
- **Logarithmic scaling** option for better visualization of similar values
- **Dynamic color palettes** (Rainbow, Heat Map, Cool Colors, Sunset, Forest, Ocean, Custom)
- **Per-country indicator selection** with distinct color coding
- **Draggable controls** and settings panels
- **Data labels** with customizable font sizes

### Data Analysis
- **Multiple visualization modes**: 3D Globe, Choropleth Maps, Tables, Histograms
- **Advanced filtering** and selection tools
- **Country-specific indicator comparisons**
- **Global vs. per-country data selections**
- **Real-time data updates** with progress tracking

### User Experience
- **Multi-language support** (English, German, French, Latin)
- **Responsive design** optimized for various screen sizes
- **Draggable UI panels** for customized layouts
- **Settings management** with localStorage persistence
- **Tutorial system** with step-by-step guidance
- **Preview mode** for resource optimization

## Technologies Used

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - Component-based UI library
- **TypeScript** - Type-safe development
- **Redux Toolkit** - State management with RTK Query
- **Material-UI (MUI)** - React component library
- **React i18next** - Internationalization framework

### 3D Visualization
- **Globe.gl** - WebGL-based 3D globe visualization
- **Three.js** - 3D graphics library
- **React-Draggable** - Draggable UI components

### Data & Backend
- **PostgreSQL** - Primary database
- **AG-Grid** - Advanced data grid
- **Knex.js** - SQL query builder
- **React-Select** - Advanced select components

### Development & Deployment
- **OpenShift** - Container platform (deployed with Argo CD)
- **Docker** - Containerization
- **ESLint** - Code linting
- **CSS Modules** - Scoped styling

## Getting Started

### Prerequisites

- **Node.js** (v18 or later)
- **npm** or **yarn**
- **PostgreSQL** database

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/pacedproton/medemap
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run DB migrations**:

   ```bash
   knex migrate:latest
   ```

4. **Configure the application**:

   - Create a `.env.local` with values:
     - `POSTGRES_USER=...`
     - `POSTGRES_PASSWORD=...`
     - `POSTGRES_HOST=...`
     - `POSTGRES_DB=...`
     - `POSTGRES_PORT=5432`
   - Optionally edit `app/config.yaml` for non-secret defaults. Secrets should not be committed.

5. **Deployment secrets** (OpenShift): they come from `.env.local` and never from git. See the
   "OpenShift Deployment" section below.

5. **Create your local env file**:

   - Copy `env.example` to `.env.local` and fill values:

     ```bash
     cp env.example .env.local
     # edit .env.local
     ```

6. **Run the development server or deploy to OpenShift**:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

8. **Open** `http://localhost:3000` in your browser.

## Project Structure

```
MeDeMAP-app/
├── app/                    # Next.js App Router
│   ├── components/         # React components
│   │   ├── GlobeGL.tsx    # Globe.gl 3D visualization
│   │   ├── SettingsDialog.tsx  # Global settings management
│   │   └── ...            # Other UI components
│   ├── 3d/                # 3D visualization pages
│   └── api/               # API routes
├── lib/                   # Application logic
│   ├── features/          # Redux slices
│   │   ├── medemap/       # Main data slice
│   │   ├── settings/      # Settings slice
│   │   └── language/      # i18n slice
│   └── store.ts          # Redux store configuration
├── locales/              # Translation files
│   ├── en.json           # English translations
│   ├── de.json           # German translations
│   ├── fr.json           # French translations
│   └── la.json           # Latin translations
├── public/               # Static assets
├── styles/               # CSS and styling
├── openshift/            # OpenShift manifests, Dockerfile, DB role SQL, secrets script
└── argocd/               # Argo CD Application
```

## Key Features & Usage

### 3D Globe Visualization

The application uses Globe.gl for 3D rendering:

**Globe.gl Engine** (`/app/components/GlobeGL.tsx`)
- WebGL-based lightweight rendering
- Custom color palettes and effects
- Per-country indicator selection
- Real-time data visualization with 3D bars
- Smooth animations and interactions

### Data Selection System

Choose between two selection modes:

1. **Global Selection**: Apply indicators to all countries
   - Use the main data selection interface
   - Consistent visualization across all European countries
   - Ideal for comparative analysis

2. **Per-Country Selection**: Customize indicators per country
   - Access through the 3D view's country-specific panel
   - Mix different indicators for different countries
   - Perfect for focused regional studies

### Settings & Customization

#### 3D Visualization Settings
```typescript
// Available in Globe.gl engine
{
  showDataLabels: boolean,           // Toggle data labels
  dataLabelFontSize: number,         // Font size (8-24pt)
  use3DLogScale: boolean,           // Logarithmic height scaling
  barSpacing: number,               // Spacing between bars
  barScale: number,                 // Height scale multiplier
  colorPalette: string             // Color scheme selection
}
```

#### Supported Color Palettes
- **Default**: Balanced HSL spectrum
- **Rainbow**: Full spectrum colors (0-300° hue)
- **Heat Map**: Yellow to red gradient
- **Cool Colors**: Blue to cyan range
- **Sunset**: Warm orange to purple
- **Forest**: Green nature tones
- **Ocean**: Blue marine palette
- **Custom**: User-defined HSL range

### Multi-Language Support

The application supports four languages with complete UI translation:

```javascript
// Available languages
const supportedLanguages = {
  'en': 'English',
  'de': 'Deutsch', 
  'fr': 'Français',
  'la': 'Latina'
};
```

## API Endpoints

### Data API
- `GET /api/data` - Fetch all media data
- `GET /api/geocoordinates` - Get country coordinates
- `GET /api/config` - Application configuration

### Configuration
The app uses `app/config.yaml` for feature flags and settings:

```yaml
features:
  previewGlobeView: true
  enableTutorial: true
  verboseLogging: false

database:
  connectionTimeout: 30000
  
cesium:
  terrainProvider: "world"
  enableLighting: true
```

## Development

### Running Tests
```bash
bun run test
```

### Building for Production
```bash
bun run build

```

### Linting
```bash
bun run lint
```

## Deployment

### bun

```bash
bun ci
```

### OpenShift Deployment
The app runs as one container on OpenShift, deployed by Argo CD from `openshift/`:

1. Build and push the image on the build host: `podman build -f openshift/Dockerfile -t <registry>/medemap/web:latest .`
2. Create the database roles and the Secret from your local env file:
   `bash openshift/create-secrets.sh /path/to/.env.local`
3. Load the data, then give the app its read-only role: `openshift/db/app-role.sql`
4. `oc apply -f argocd/medemap.yaml`, then point the Cloudflare tunnel route at `http://medemap-web.medemap.svc:80`

The AI assistant needs `AI_ACCESS_KEY` (the shared key you give to approved users). The dialog tells
people to email the address in `lib/ai/contact.ts` to ask for it; see `.env.example`.

### Environment Variables
Required environment variables:
```bash
POSTGRES_USER=your_db_user
POSTGRES_PASSWORD=your_db_password
POSTGRES_HOST=your_db_host
POSTGRES_DB=your_db_name
POSTGRES_PORT=5432
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

MeDeMAP is developed as part of research into media environments and democratic functions across European countries. Special thanks to the research teams and data providers who make this visualization possible.
