"""Workflow utility functions for loading templates and injecting parameters."""

import copy
import json
from pathlib import Path
from typing import Any, Dict, List

# Project root resolved relative to this file's location (core/ -> manju/)
_PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_workflow_template(template_path: str) -> dict:
    """Load and parse a workflow template JSON file.

    Args:
        template_path: Path to the template file. Can be absolute or relative
                       to the project root.

    Returns:
        dict: Parsed workflow template.

    Raises:
        FileNotFoundError: If the template file does not exist.
        ValueError: If the file contains invalid JSON.
    """
    path = Path(template_path)

    # Resolve relative paths against project root
    if not path.is_absolute():
        path = _PROJECT_ROOT / path

    if not path.exists():
        raise FileNotFoundError(
            f"Workflow template file not found: {path}. "
            "Please verify the template path is correct."
        )

    text = path.read_text(encoding="utf-8")

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Failed to parse workflow template JSON at {path}: {exc}"
        ) from exc

    return data


def load_node_mapping() -> dict:
    """Load the node mapping configuration from templates/node_mapping.json.

    Returns:
        dict: Parsed node mapping with workflow-type keys (e.g. 'gacha', 'video_render'),
              each containing parameter-to-node target mappings.

    Raises:
        FileNotFoundError: If templates/node_mapping.json does not exist.
        ValueError: If the file contains invalid JSON.
    """
    mapping_path = _PROJECT_ROOT / "templates" / "node_mapping.json"

    if not mapping_path.exists():
        raise FileNotFoundError(
            f"Node mapping file not found: {mapping_path}. "
            "Ensure templates/node_mapping.json exists in the project root."
        )

    text = mapping_path.read_text(encoding="utf-8")

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"Failed to parse node mapping JSON at {mapping_path}: {exc}"
        ) from exc

    return data


def inject_workflow_params(
    workflow: dict,
    node_mapping: dict,
    params: dict,
) -> dict:
    """Inject parameter values into a workflow at locations specified by node_mapping.

    Creates a deep copy of the workflow and sets values at the positions defined
    by each parameter's node_id and field_path in node_mapping.

    Args:
        workflow: ComfyUI API-format workflow dict (node_id -> node_data).
        node_mapping: Maps parameter names to injection targets.
            Format: {"param_name": {"node_id": "6", "field_path": ["inputs", "text"]}}
        params: Maps parameter names to values to inject.

    Returns:
        A modified deep copy of the workflow with injected values.

    Raises:
        KeyError: If a referenced node_id does not exist in the workflow.
    """
    result = copy.deepcopy(workflow)

    for param_name, value in params.items():
        if param_name not in node_mapping:
            continue

        target = node_mapping[param_name]
        node_id = target["node_id"]
        field_path: List[str] = target["field_path"]

        if node_id not in result:
            raise KeyError(
                f"Node ID '{node_id}' referenced by parameter '{param_name}' "
                f"does not exist in the workflow. Available nodes: {list(result.keys())}"
            )

        # Navigate to the parent of the target field and set the value
        obj = result[node_id]
        for key in field_path[:-1]:
            obj = obj[key]
        obj[field_path[-1]] = value

    return result
