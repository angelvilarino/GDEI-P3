#!/usr/bin/env python3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def write_file(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def render_png(dot_path: Path, png_path: Path) -> None:
    cmd = ["dot", "-Tpng", "-Gdpi=185", str(dot_path), "-o", str(png_path)]
    subprocess.run(cmd, check=True)


def architecture_dot() -> str:
    return r'''digraph AuraVaultArchitecture {
  graph [
    rankdir=TB,
    bgcolor="#0b1020",
    pad=0.55,
    nodesep=1.05,
    ranksep="1.15 equally",
    splines=polyline,
    overlap=false,
    outputorder=edgesfirst,
    fontname="Helvetica"
  ];

  node [
    shape=box,
    style="rounded,filled",
    fontname="Helvetica",
    fontsize=14,
    fontcolor="#f3f8ff",
    color="#d7e4ff",
    penwidth=1.6,
    margin="0.30,0.22"
  ];

  edge [
    color="#d7e4ff",
    penwidth=1.8,
    arrowsize=0.9,
    fontname="Helvetica",
    fontsize=11,
    fontcolor="#f3f8ff"
  ];

  subgraph cluster_iot {
    label="CAPA IOT";
    labelloc=t;
    fontsize=17;
    fontcolor="#cde5ff";
    color="#3b5e9a";
    fillcolor="#12213d";
    style="rounded,filled";

    simulator [label="Simulador IoT", fillcolor="#296d98"];
    mosquitto [label="Mosquitto", fillcolor="#2f7f86"];
    iotagent [label="IoT Agent", fillcolor="#437b99"];

    { rank=same; simulator; mosquitto; iotagent; }
  }

  subgraph cluster_context {
    label="CAPA CONTEXTO";
    labelloc=t;
    fontsize=17;
    fontcolor="#cde5ff";
    color="#496da8";
    fillcolor="#142845";
    style="rounded,filled";

    orion_l [label="", shape=point, width=0.01, style=invis];
    orion [label="Orion CB", fillcolor="#4f6aa5", width=2.2, height=1.0];
    orion_r [label="", shape=point, width=0.01, style=invis];

    { rank=same; orion_l; orion; orion_r; }
  }

  subgraph cluster_persist {
    label="CAPA PERSISTENCIA";
    labelloc=t;
    fontsize=17;
    fontcolor="#d8f1ff";
    color="#2f7b80";
    fillcolor="#132f38";
    style="rounded,filled";

    ql [label="QuantumLeap", fillcolor="#2f7f86", width=2.4, height=1.0];
    crate [label="CrateDB", fillcolor="#2f6e7b", width=2.2, height=1.0];

    { rank=same; ql; crate; }
  }

  subgraph cluster_app {
    label="CAPA APLICACION";
    labelloc=t;
    fontsize=17;
    fontcolor="#e4f2ff";
    color="#7a689f";
    fillcolor="#2a2240";
    style="rounded,filled";

    flask [label="Flask backend", fillcolor="#5d4a86", width=2.6, height=1.0];
    sk [label="scikit-learn", fillcolor="#5b6b92", width=2.4, height=1.0];

    { rank=same; flask; sk; }
  }

  subgraph cluster_front {
    label="CAPA PRESENTACION";
    labelloc=t;
    fontsize=17;
    fontcolor="#fff1d6";
    color="#9a7b3a";
    fillcolor="#3a2e13";
    style="rounded,filled";

    frontend [label="Frontend", fillcolor="#8a6b2f", width=2.2, height=1.0];
    leaflet [label="Leaflet", fillcolor="#7f6a35", width=1.8, height=0.92];
    chartjs [label="Chart.js", fillcolor="#7f6a35", width=1.8, height=0.92];
    threejs [label="Three.js", fillcolor="#7f6a35", width=1.8, height=0.92];
    grafana [label="Grafana", fillcolor="#7f6a35", width=1.8, height=0.92];
    chatbot [label="Chatbot LLM", fillcolor="#7f6a35", width=2.0, height=0.92];

    { rank=same; frontend; leaflet; chartjs; threejs; grafana; chatbot; }
  }

  simulator -> mosquitto [label="MQTT publish"];
  mosquitto -> iotagent [label="telemetria"];
  iotagent -> orion [label="upsert NGSI-LD"];

  orion -> ql [label="suscripciones"];
  ql -> crate [label="timeseries"];
  ql -> flask [label="historicos"];
  crate -> flask [label="consulta analitica"];

  flask -> frontend [label="REST + WebSocket"];
  frontend -> leaflet;
  frontend -> chartjs;
  frontend -> threejs;
  frontend -> grafana;
  frontend -> chatbot;

  ql -> sk [label="flujo lateral ML", color="#ffd07a", fontcolor="#ffe4aa", penwidth=2.0];
  sk -> flask [label="riesgo", color="#ffd07a", fontcolor="#ffe4aa", penwidth=2.0];

  orion_l -> ql [style=invis, weight=12];
  orion_r -> crate [style=invis, weight=12];
  chartjs -> threejs [style=invis, weight=4];
  threejs -> grafana [style=invis, weight=4];
  grafana -> chatbot [style=invis, weight=4];
}
'''


def data_model_dot() -> str:
    return r'''digraph AuraVaultDataModel {
  graph [
    rankdir=TB,
    bgcolor="#0b1020",
    pad=0.70,
    nodesep=1.55,
    ranksep="1.45 equally",
    splines=spline,
    overlap=false,
    outputorder=edgesfirst,
    fontname="Helvetica"
  ];

  node [
    shape=box,
    style="rounded,filled",
    fontname="Helvetica",
    fontsize=12,
    fontcolor="#f3f8ff",
    color="#d7e4ff",
    penwidth=1.5,
    margin="0.40,0.28",
    width=3.4,
    height=1.15
  ];

  edge [
    color="#d7e4ff",
    penwidth=1.6,
    arrowsize=0.85,
    fontname="Helvetica",
    fontsize=10,
    fontcolor="#f3f8ff"
  ];

  museum [
    fillcolor="#4b6ea8",
    label="Museum\nname\nlocation\nmuseumType\nfacilities"
  ];

  room [
    fillcolor="#3f7a66",
    label="Room\nname\nfloor\narea, capacity\nstatus"
  ];

  indoor [
    fillcolor="#2f7f86",
    label="IndoorEnvironmentObserved\ndateObserved\ntemperature, relativeHumidity\nco2, illuminance"
  ];

  noise [
    fillcolor="#2f7f86",
    label="NoiseLevelObserved\ndateObserved\nLAeq, LAmax\nLAS, sonometerClass"
  ];

  crowd [
    fillcolor="#2f7f86",
    label="CrowdFlowObserved\ndateObserved\npeopleCount, occupancy\naverageCrowdSpeed, congested"
  ];

  alert [
    fillcolor="#8a4e4e",
    label="Alert\ncategory, subCategory\nseverity, status\ndateIssued"
  ];

  device [
    fillcolor="#4b5f9d",
    label="Device\ncontrolledProperty\ndeviceState, batteryLevel\nvalue, refDeviceModel"
  ];

  devicemodel [
    fillcolor="#436f9c",
    label="DeviceModel\nmodelName\nmanufacturerName, category\nsupportedProtocol, supportedUnits"
  ];

  artwork [
    fillcolor="#7e5b9d",
    label="Artwork\nname, artist\nmaterial\ndegradationRisk, conditionStatus"
  ];

  actuator [
    fillcolor="#8a6b3f",
    label="Actuator\nactuatorType, status\ncommandSent\ntargetProperty, isControlledBy"
  ];

  top_anchor [label="", shape=point, width=0.01, style=invis];
  right_anchor [label="", shape=point, width=0.01, style=invis];

  { rank=same; top_anchor; museum; right_anchor; devicemodel; }
  { rank=same; room; device; }
  { rank=same; indoor; noise; crowd; alert; }
  { rank=same; artwork; actuator; }

  museum -> room [label="contains / isLocatedIn"];

  room -> indoor [label="refPointOfInterest"];
  room -> noise [label="refPointOfInterest"];
  room -> crowd [label="refPointOfInterest"];

  indoor -> device [label="refDevice"];
  noise -> device [label="refDevice"];
  crowd -> device [label="refDevice"];

  device -> devicemodel [label="refDeviceModel"];

  room -> artwork [label="isExposedIn"];

  actuator -> room [label="isLocatedIn"];
  actuator -> device [label="isControlledBy"];

  alert -> device [label="alertSource"];
  alert -> room [label="alertSource"];
  alert -> artwork [label="alertSource"];

  top_anchor -> room [style=invis, weight=10];
  right_anchor -> device [style=invis, weight=10];
  noise -> crowd [style=invis, weight=5];
  indoor -> artwork [style=invis, weight=4];
}
'''


def main() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)

    architecture_dot_path = DOCS / "architecture_graph.dot"
    data_model_dot_path = DOCS / "data_model_graph.dot"
    architecture_png = DOCS / "architecture.png"
    data_model_png = DOCS / "data_model.png"

    write_file(architecture_dot_path, architecture_dot())
    write_file(data_model_dot_path, data_model_dot())

    render_png(architecture_dot_path, architecture_png)
    render_png(data_model_dot_path, data_model_png)

    print(f"Generated: {architecture_png}")
    print(f"Generated: {data_model_png}")


if __name__ == "__main__":
    main()
