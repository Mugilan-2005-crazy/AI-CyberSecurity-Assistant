/**
 * utils/chartSetup.js
 * ------------------------------------------------------------
 * Lazy Chart.js registration. Only imports Chart.js when the
 * first chart component needs it, keeping the initial bundle
 * small. Subsequent calls are no-ops (memoized).
 */
let registered = false;

export async function ensureChartRegistered() {
  if (registered) return;
  registered = true;

  const {
    Chart: ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
    Title,
  } = await import('chart.js');

  ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Filler,
    Title
  );
}

export default ensureChartRegistered;
