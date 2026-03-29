import React, { memo, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Sigma } from 'lucide-react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist-min';
import { create, all } from 'mathjs';
import { useLocalize } from '~/hooks';
import cn from '~/utils/cn';

type TFunctionPlotConfig = {
  expr?: string;
  functions?: Array<{
    expr: string;
    label?: string;
    color?: string;
  }>;
  domain?: [number, number];
  samples?: number;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  color?: string;
};

type TFunctionPlotProps = {
  children: string;
};

const math = create(all, {});
const PlotComponent = createPlotlyComponent(Plotly) as TPlotComponent;

type TPlotComponentProps = {
  data: Array<Record<string, unknown>>;
  layout: Record<string, unknown>;
  config: Record<string, unknown>;
  useResizeHandler: boolean;
  className?: string;
  style?: React.CSSProperties;
};

type TPlotComponent = React.ComponentType<TPlotComponentProps>;

const DEFAULT_DOMAIN: [number, number] = [-10, 10];
const DEFAULT_SAMPLES = 400;
const DEFAULT_COLOR = '#2563eb';
const DEFAULT_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2'];

type TRenderableFunction = {
  expr: string;
  label: string;
  color: string;
};

type TResolvedFunctionPlotConfig = Omit<TFunctionPlotConfig, 'functions'> & {
  functions: TRenderableFunction[];
};

function parseConfig(content: string): TResolvedFunctionPlotConfig {
  const parsed = JSON.parse(content) as TFunctionPlotConfig;

  const parsedFunctions = Array.isArray(parsed.functions)
    ? parsed.functions
        .filter((item) => typeof item?.expr === 'string' && item.expr.trim() !== '')
        .map((item, index) => ({
          expr: item.expr.trim(),
          label: item.label?.trim() || `f${index + 1}(x) = ${item.expr.trim()}`,
          color: item.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        }))
    : [];

  if (parsedFunctions.length === 0 && (typeof parsed.expr !== 'string' || parsed.expr.trim() === '')) {
    throw new Error('Missing required `expr` field or non-empty `functions` array.');
  }

  const functions =
    parsedFunctions.length > 0
      ? parsedFunctions
      : [
          {
            expr: parsed.expr!.trim(),
            label: `f(x) = ${parsed.expr!.trim()}`,
            color: parsed.color ?? DEFAULT_COLOR,
          },
        ];

  return {
    ...parsed,
    functions,
  };
}

function createRange(domain: [number, number], sampleCount: number): number[] {
  const [start, end] = domain;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) {
    throw new Error('Invalid `domain`.');
  }

  const count = Math.max(20, sampleCount);
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, index) => start + step * index);
}

function evaluateFunction(expr: string, xValues: number[]) {
  const compiled = math.compile(expr);
  const yValues = xValues.map((x) => {
    const value = compiled.evaluate({ x });
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    return value;
  });

  return yValues;
}

const FunctionPlot = memo(({ children }: TFunctionPlotProps) => {
  const localize = useLocalize();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const parsed = useMemo(() => {
    try {
      const config = parseConfig(children);
      const domain = config.domain ?? DEFAULT_DOMAIN;
      const samples = config.samples ?? DEFAULT_SAMPLES;
      const xValues = createRange(domain, samples);
      const traces = config.functions.map((fn) => ({
        x: xValues,
        y: evaluateFunction(fn.expr, xValues),
        type: 'scatter',
        mode: 'lines',
        name: fn.label,
        line: {
          color: fn.color,
          width: 2.5,
        },
        hovertemplate: `${fn.label}<br>x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>`,
      }));

      return {
        ok: true as const,
        config,
        traces,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : 'Invalid function block.',
      };
    }
  }, [children]);

  if (!parsed.ok) {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-border-light">
        <div className="flex items-center gap-2 border-b border-border-light bg-surface-secondary px-4 py-2 font-sans text-xs text-text-secondary">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-medium">function</span>
        </div>
        <div className="bg-surface-primary-alt p-4 text-sm text-red-600 dark:text-red-300">
          {localize('com_ui_function_plot_invalid')}: {parsed.error}
        </div>
        <pre className="overflow-auto border-t border-border-light bg-surface-secondary p-4 text-xs text-text-secondary">
          {children}
        </pre>
      </div>
    );
  }

  const { config, traces } = parsed;
  const title =
    config.title?.trim() ||
    (config.functions.length === 1
      ? config.functions[0].label
      : config.functions.map((fn) => fn.label).join(' vs '));

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border-light">
      <div className="flex items-center gap-2 border-b border-border-light bg-surface-secondary px-4 py-2 font-sans text-xs text-text-secondary">
        <Sigma className="h-3.5 w-3.5" />
        <span className="font-medium">{title}</span>
      </div>
      <div className="bg-surface-primary-alt p-2">
        {!isClient ? (
          <div className="flex min-h-[320px] items-center justify-center text-sm text-text-secondary">
            {localize('com_ui_loading')}
          </div>
        ) : (
          <PlotComponent
            data={traces}
            layout={{
              autosize: true,
              height: 360,
              margin: { l: 48, r: 24, t: 24, b: 48 },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              dragmode: 'pan',
              hovermode: 'closest',
              showlegend: traces.length > 1,
              xaxis: {
                title: config.xLabel ?? 'x',
                zeroline: true,
                showgrid: true,
              },
              yaxis: {
                title: config.yLabel ?? 'y',
                zeroline: true,
                showgrid: true,
              },
            }}
            config={{
              displaylogo: false,
              responsive: true,
              scrollZoom: true,
              modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            }}
            useResizeHandler={true}
            className={cn('w-full')}
            style={{ width: '100%' }}
          />
        )}
      </div>
      <div className="border-t border-border-light bg-surface-secondary px-4 py-2 text-xs text-text-secondary">
        {localize('com_ui_function_plot_hint')}
      </div>
    </div>
  );
});

FunctionPlot.displayName = 'FunctionPlot';

export default FunctionPlot;
