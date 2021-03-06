import React, { Component } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  Alert,
  TouchableOpacity
} from "react-native";
import * as turf from "@turf/turf"
import sacJson from "./geojson/sac.json" 

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default class App extends Component {
  state = {
    location: null,
    longitude: 0,
    latitude: 0
  };

  coordUpdate = () => {
    var sac = turf.featureCollection(sacJson.features);
    var location = turf.point([this.state.longitude, this.state.latitude]); 

    console.log(turf.booleanContains(turf.envelope(sac), location));
  }

  findCoordinates = () => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const longitude = position.coords.longitude;
        const latitude = position.coords.latitude;
        this.setState({ 
            location: `${longitude}, ${latitude}`,
            longitude,
            latitude 
        });
        this.coordUpdate();
      },
      error => Alert.alert(error.message),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
    );
  };

  render() {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={this.findCoordinates}>
          <Text style={styles.welcome}>Find My Coords?</Text>
          <Text>Location: {this.state.location}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}