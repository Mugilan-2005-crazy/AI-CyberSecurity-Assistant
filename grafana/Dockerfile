FROM grafana/grafana:latest
USER root
COPY provisioning/ /etc/grafana/provisioning/
RUN mkdir -p /var/lib/grafana/dashboards
COPY dashboards/ /var/lib/grafana/dashboards/
RUN chown -R grafana:grafana /var/lib/grafana/dashboards /etc/grafana/provisioning
USER grafana
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/run.sh"]